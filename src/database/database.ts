
import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  );

  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('note', 'link', 'image')),
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

    await db.execAsync('PRAGMA user_version = 1;');
  }
}
