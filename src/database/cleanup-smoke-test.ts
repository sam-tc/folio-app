import * as SQLite from 'expo-sqlite';

import {
  permanentlyDeleteItem,
  purgeExpiredDeletedItems,
} from './items';

const TEST_DATABASE = 'folio-cleanup-test-only.db';

type TestItem = {
  id: number;
};

type PendingImage = {
  uri: string;
};

export async function runCleanupSmokeTest(): Promise<void> {
  // Never use the actual folio.db database for this test.
  const db = await SQLite.openDatabaseAsync(TEST_DATABASE);

  try {
    // Recreate only the temporary test tables.
    await db.execAsync(`
      DROP TABLE IF EXISTS pending_image_deletions;
      DROP TABLE IF EXISTS items;

      CREATE TABLE items (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        image_uri TEXT,
        deleted_at TEXT
      );

      CREATE TABLE pending_image_deletions (
        uri TEXT PRIMARY KEY,
        queued_at TEXT NOT NULL
      );
    `);

    const insertSQL = `
      INSERT INTO items (id, type, image_uri, deleted_at)
      VALUES (?, ?, ?, ?)
    `;

    // 1. Active note: must remain.
    await db.runAsync(insertSQL, [
      1,
      'note',
      null,
      null,
    ]);

    // 2. Recently deleted note: must remain.
    await db.runAsync(insertSQL, [
      2,
      'note',
      null,
      '2026-10-09T12:00:00.000Z',
    ]);

    // 3. Expired note: should be removed.
    await db.runAsync(insertSQL, [
      3,
      'note',
      null,
      '2026-09-01T12:00:00.000Z',
    ]);

    // 4. Note deleted exactly 30 days ago: remove.
    await db.runAsync(insertSQL, [
      4,
      'note',
      null,
      '2026-09-14T12:00:00.000Z',
    ]);

    // 5. Expired image: remove record and queue its file.
    await db.runAsync(insertSQL, [
      5,
      'image',
      'file:///fake-test/expired-image.png',
      '2026-09-01T12:00:00.000Z',
    ]);

    // 6. Recently deleted image: must remain recoverable.
    await db.runAsync(insertSQL, [
      6,
      'image',
      'file:///fake-test/recent-image.png',
      '2026-10-09T12:00:00.000Z',
    ]);

    // 7. Active image: must remain untouched.
    await db.runAsync(insertSQL, [
      7,
      'image',
      'file:///fake-test/active-image.png',
      null,
    ]);

    // 8. Image selected for manual permanent deletion.
    await db.runAsync(insertSQL, [
      8,
      'image',
      'file:///fake-test/manual-image.png',
      '2026-10-13T12:00:00.000Z',
    ]);

    // Test manually deleting an image already in trash.
    await permanentlyDeleteItem(db, 8);

    const manualItem = await db.getFirstAsync<TestItem>(
      'SELECT id FROM items WHERE id = 8'
    );

    const manualQueueEntry =
      await db.getFirstAsync<PendingImage>(
        `SELECT uri
         FROM pending_image_deletions
         WHERE uri = ?`,
        ['file:///fake-test/manual-image.png']
      );

    if (manualItem !== null || !manualQueueEntry) {
      throw new Error(
        'Manual deletion failed to queue the image.'
      );
    }

    console.log(
      'PASS: Manual permanent deletion queues its image.'
    );

    // Use a fixed date so the test is reproducible.
    const testNow = new Date(
      '2026-10-14T12:00:00.000Z'
    );

    const deletedCount = await purgeExpiredDeletedItems(
      db,
      testNow
    );

    // Check which database records remain.
    const remainingItems =
      await db.getAllAsync<TestItem>(
        'SELECT id FROM items ORDER BY id'
      );

    const remainingIds = remainingItems.map(
      (item) => item.id
    );

    const expectedIds = [1, 2, 6, 7];

    if (
      deletedCount !== 3 ||
      remainingIds.join(',') !== expectedIds.join(',')
    ) {
      throw new Error(
        `Expiration test failed. Deleted: ${deletedCount}; ` +
        `Remaining IDs: ${remainingIds.join(',')}`
      );
    }

    console.log(
      'PASS: Expired items removed; active and recent items preserved.'
    );

    // Check the pending deletion queue.
    const pendingImages =
      await db.getAllAsync<PendingImage>(
        `SELECT uri
         FROM pending_image_deletions
         ORDER BY uri`
      );

    const queuedUris = pendingImages
      .map((item) => item.uri)
      .sort();

    const expectedUris = [
      'file:///fake-test/expired-image.png',
      'file:///fake-test/manual-image.png',
    ].sort();

    if (
      queuedUris.join(',') !== expectedUris.join(',')
    ) {
      throw new Error(
        'Image cleanup queue contains unexpected files.'
      );
    }

    console.log(
      'PASS: Only permanently deleted images are queued.'
    );

    console.log(
      'PASS: All image deletion database tests completed.'
    );
  } finally {
    // Only delete the separate temporary test database.
    await db.closeAsync();
    await SQLite.deleteDatabaseAsync(TEST_DATABASE);
  }
}
