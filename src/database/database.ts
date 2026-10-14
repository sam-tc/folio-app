import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 3;

export async function initializeDatabase(db: SQLiteDatabase) {
  // Enable Write-Ahead Logging.
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Read the database's current schema version.
  const result = await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version;');

  let currentVersion = result?.user_version ?? 0;

  // Prevent an older app version from modifying a newer database.
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

      // Avoid attempting to add an existing column.
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

  // Version 2 -> 3: Add persistent image deletion tracking.
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

  // Safeguard:
  // Repair a missing cleanup table even if the database
  // already reports schema version 3.
  //
  // IF NOT EXISTS keeps all existing queue entries intact.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_image_deletions (
      uri TEXT PRIMARY KEY,
      queued_at TEXT NOT NULL
    );
  `);

  // Confirm the required table is available.
  const cleanupTable = await db.getFirstAsync<{
    name: string;
  }>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name = 'pending_image_deletions'
     LIMIT 1`
  );

  if (!cleanupTable) {
    throw new Error(
      'Image cleanup table could not be initialized.'
    );
  }
}
