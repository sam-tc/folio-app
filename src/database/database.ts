import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 4;

export async function initializeDatabase(
  db: SQLiteDatabase
) {
  // Enable Write-Ahead Logging.
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Read the current database schema version.
  const result = await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version;');

  let currentVersion = result?.user_version ?? 0;

  // Prevent older app versions from modifying newer databases.
  if (currentVersion > DATABASE_VERSION) {
    throw new Error('Unsupported database version.');
  }

  // Version 0 -> 1: Create the original items table.
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

  // Version 1 -> 2: Add Recently Deleted support.
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

  // Version 2 -> 3: Track image files needing cleanup.
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

  // Version 3 -> 4: Prepare local items for cloud sync.
  if (currentVersion === 3) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const columns = await txn.getAllAsync<{
        name: string;
      }>('PRAGMA table_info(items);');

      const hasColumn = (name: string) =>
        columns.some((column) => column.name === name);

      // A cloud UUID identifies the matching Supabase record.
      // NULL is allowed for existing, not-yet-synced items.
      if (!hasColumn('cloud_id')) {
        await txn.execAsync(`
          ALTER TABLE items
          ADD COLUMN cloud_id TEXT;
        `);
      }

      // Keep the remote image location separate from
      // the image file stored on this device.
      if (!hasColumn('cloud_image_path')) {
        await txn.execAsync(`
          ALTER TABLE items
          ADD COLUMN cloud_image_path TEXT;
        `);
      }

      // Existing items need their first cloud upload.
      if (!hasColumn('sync_status')) {
        await txn.execAsync(`
          ALTER TABLE items
          ADD COLUMN sync_status TEXT NOT NULL
          DEFAULT 'pending'
          CHECK (sync_status IN ('pending', 'synced'));
        `);
      }

      // One local item must not point to the same cloud record
      // as another local item.
      await txn.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS
          idx_items_cloud_id
        ON items(cloud_id)
        WHERE cloud_id IS NOT NULL;
      `);

      // Preserve remote deletion requests across app restarts.
      // We will use this when integrating permanent deletion.
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

  // Preserve Stage 1's persistent image-cleanup queue.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_image_deletions (
      uri TEXT PRIMARY KEY,
      queued_at TEXT NOT NULL
    );
  `);

  // Ensure the cloud-deletion queue exists.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_cloud_deletions (
      cloud_id TEXT PRIMARY KEY,
      cloud_image_path TEXT,
      queued_at TEXT NOT NULL
    );
  `);

  // Verify both required cleanup tables exist.
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

  // Confirm that the database is now on the expected version.
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
