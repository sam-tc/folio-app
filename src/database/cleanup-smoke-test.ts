
import * as SQLite from 'expo-sqlite';

import { purgeExpiredDeletedItems } from './items';

const TEST_DATABASE = 'folio-cleanup-test-only.db';

export async function runCleanupSmokeTest() {
  // This is NOT our real folio.db database.
  const db = await SQLite.openDatabaseAsync(TEST_DATABASE);

  try {
    // Prepare a small database containing test records only.
    await db.execAsync(`
      DROP TABLE IF EXISTS items;

      CREATE TABLE items (
        id INTEGER PRIMARY KEY,
        deleted_at TEXT
      );
    `);

    const insertSQL =
      'INSERT INTO items (id, deleted_at) VALUES (?, ?)';

    // Active item: must remain.
    await db.runAsync(insertSQL, [1, null]);

    // Deleted 5 days before the simulated current date.
    await db.runAsync(insertSQL, [
      2,
      '2026-10-09T12:00:00.000Z',
    ]);

    // Deleted more than 30 days ago.
    await db.runAsync(insertSQL, [
      3,
      '2026-09-01T12:00:00.000Z',
    ]);

    // Deleted exactly 30 days ago.
    await db.runAsync(insertSQL, [
      4,
      '2026-09-14T12:00:00.000Z',
    ]);

    // Use a fixed date to make the test reproducible.
    const testNow = new Date('2026-10-14T12:00:00.000Z');

    const deletedCount = await purgeExpiredDeletedItems(
      db,
      testNow
    );

    const remaining = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM items ORDER BY id'
    );

    const remainingIds = remaining.map((item) => item.id);

    if (
      deletedCount !== 2 ||
      remainingIds.join(',') !== '1,2'
    ) {
      throw new Error(
        `Cleanup test failed. Deleted: ${deletedCount}; ` +
        `Remaining IDs: ${remainingIds.join(',')}`
      );
    }

    console.log(
      'PASS: 30-day cleanup removed only expired items.'
    );
  } finally {
    // Close and remove ONLY our temporary test database.
    await db.closeAsync();
    await SQLite.deleteDatabaseAsync(TEST_DATABASE);
  }
}
