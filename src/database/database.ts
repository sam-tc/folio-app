import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 5;

export async function initializeDatabase(
  db: SQLiteDatabase
) {
  // Improve reliability for normal database operations.
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const result = await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version;');

  let currentVersion = result?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error('Unsupported database version.');
  }

  // Version 0 -> 1: Original local item storage.
  if (currentVersion === 0) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL
            CHECK (type IN ('note', 'link', 'image')),
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          image_uri TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          is_archived INTEGER NOT NULL DEFAULT 0
            CHECK (is_archived IN (0, 1))
        );
      `);

      await txn.execAsync('PRAGMA user_version = 1;');
    });

    currentVersion = 1;
  }

  // Version 1 -> 2: Recently Deleted.
  if (currentVersion === 1) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const columns = await txn.getAllAsync<{
        name: string;
      }>('PRAGMA table_info(items);');

      const hasDeletedAt = columns.some(
        (column) => column.name === 'deleted_at'
      );

      if (!hasDeletedAt) {
        await txn.execAsync(`
          ALTER TABLE items
          ADD COLUMN deleted_at TEXT;
        `);
      }

      await txn.execAsync('PRAGMA user_version = 2;');
    });

    currentVersion = 2;
  }

  // Version 2 -> 3: Queue local image cleanup.
  if (currentVersion === 2) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_image_deletions (
          uri TEXT PRIMARY KEY,
          queued_at TEXT NOT NULL
        );
      `);

      await txn.execAsync('PRAGMA user_version = 3;');
    });

    currentVersion = 3;
  }

  // Version 3 -> 4: Cloud synchronization fields.
  if (currentVersion === 3) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const columns = await txn.getAllAsync<{
        name: string;
      }>('PRAGMA table_info(items);');

      const hasColumn = (name: string) =>
        columns.some((column) => column.name === name);

      if (!hasColumn('cloud_id')) {
        await txn.execAsync(`
          ALTER TABLE items
          ADD COLUMN cloud_id TEXT;
        `);
      }

      if (!hasColumn('cloud_image_path')) {
        await txn.execAsync(`
          ALTER TABLE items
          ADD COLUMN cloud_image_path TEXT;
        `);
      }

      if (!hasColumn('sync_status')) {
        await txn.execAsync(`
          ALTER TABLE items
          ADD COLUMN sync_status TEXT NOT NULL
          DEFAULT 'pending'
          CHECK (sync_status IN ('pending', 'synced'));
        `);
      }

      await txn.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS
          idx_items_cloud_id
        ON items(cloud_id)
        WHERE cloud_id IS NOT NULL;
      `);

      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_cloud_deletions (
          cloud_id TEXT PRIMARY KEY,
          cloud_image_path TEXT,
          queued_at TEXT NOT NULL
        );
      `);

      await txn.execAsync('PRAGMA user_version = 4;');
    });

    currentVersion = 4;
  }

  // Version 4 -> 5: Track local edits automatically.
  if (currentVersion === 4) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      /*
       * A SQLite trigger is an automatic database action.
       *
       * When a saved item's meaningful content or location
       * changes, the record becomes pending again.
       *
       * Updating only cloud_id or sync_status does not
       * trigger this rule.
       */
      await txn.execAsync(`
        CREATE TRIGGER IF NOT EXISTS
          mark_item_pending_after_edit
        AFTER UPDATE OF
          title,
          content,
          tags,
          image_uri,
          is_archived,
          deleted_at
        ON items
        FOR EACH ROW
        WHEN
          OLD.title IS NOT NEW.title
          OR OLD.content IS NOT NEW.content
          OR OLD.tags IS NOT NEW.tags
          OR OLD.image_uri IS NOT NEW.image_uri
          OR OLD.is_archived IS NOT NEW.is_archived
          OR OLD.deleted_at IS NOT NEW.deleted_at
        BEGIN
          UPDATE items
          SET sync_status = 'pending'
          WHERE id = NEW.id;
        END;
      `);

      await txn.execAsync('PRAGMA user_version = 5;');
    });

    currentVersion = 5;
  }

  // Keep local image cleanup available.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_image_deletions (
      uri TEXT PRIMARY KEY,
      queued_at TEXT NOT NULL
    );
  `);

  // Keep pending remote deletions available.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_cloud_deletions (
      cloud_id TEXT PRIMARY KEY,
      cloud_image_path TEXT,
      queued_at TEXT NOT NULL
    );
  `);

  const tables = await db.getAllAsync<{
    name: string;
  }>(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name IN (
        'pending_image_deletions',
        'pending_cloud_deletions'
      );
  `);

  const tableNames = new Set(
    tables.map((table) => table.name)
  );

  if (
    !tableNames.has('pending_image_deletions') ||
    !tableNames.has('pending_cloud_deletions')
  ) {
    throw new Error(
      'Folio cleanup tables could not be initialized.'
    );
  }

  // Verify the edit-tracking trigger exists.
  const trigger = await db.getFirstAsync<{
    name: string;
  }>(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'trigger'
      AND name = 'mark_item_pending_after_edit';
  `);

  if (!trigger) {
    throw new Error(
      'Folio cloud edit tracking could not be initialized.'
    );
  }

  const version = await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version;');

  if (version?.user_version !== DATABASE_VERSION) {
    throw new Error(
      'Folio database migration did not complete.'
    );
  }

  console.log(
    'Folio database schema verified: version',
    DATABASE_VERSION
  );
}
