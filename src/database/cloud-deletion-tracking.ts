import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Install automatic tracking for permanent cloud deletions.
 *
 * When an item with a cloud_id is deleted locally,
 * SQLite records its cloud identity before the
 * deletion transaction completes.
 *
 * This works for both:
 * - Manual permanent deletion
 * - Automatic 30-day expiry
 *
 * No network connection is required.
 */
export async function installCloudDeletionTracking(
  db: SQLiteDatabase
): Promise<void> {
  await db.execAsync(`
    CREATE TRIGGER IF NOT EXISTS
      queue_cloud_deletion_after_local_delete
    AFTER DELETE ON items
    FOR EACH ROW
    WHEN OLD.cloud_id IS NOT NULL
    BEGIN
      INSERT OR IGNORE INTO pending_cloud_deletions (
        cloud_id,
        cloud_image_path,
        queued_at
      )
      VALUES (
        OLD.cloud_id,
        OLD.cloud_image_path,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      );
    END;
  `);

  const trigger = await db.getFirstAsync<{
    name: string;
  }>(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'trigger'
      AND name = 'queue_cloud_deletion_after_local_delete';
  `);

  if (!trigger) {
    throw new Error(
      'Cloud deletion tracking could not be initialized.'
    );
  }

  console.log(
    'Folio cloud deletion tracking initialized.'
  );
}
