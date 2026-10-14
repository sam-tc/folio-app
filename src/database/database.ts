import type { SQLiteDatabase } from 'expo-sqlite';

// Version 2 introduces the deleted_at column.
const DATABASE_VERSION = 2;

export async function initializeDatabase(db: SQLiteDatabase) {
  // Improve SQLite read/write behavior.
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Read the database's existing schema version.
  const result = await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version;');

  let currentVersion = result?.user_version ?? 0;

  // Avoid opening a database created by a newer schema.
  if (currentVersion > DATABASE_VERSION) {
    throw new Error('Unsupported database version.');
  }

  // Migration 0 -> 1: Create the original items table.
  // This runs only for a brand-new database.
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

  // Migration 1 -> 2: Add Recently Deleted support.
  if (currentVersion === 1) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(`
        ALTER TABLE items
        ADD COLUMN deleted_at TEXT;
      `);

      await txn.execAsync('PRAGMA user_version = 2;');
    });
  }
}
