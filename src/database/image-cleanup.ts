import type { SQLiteDatabase } from 'expo-sqlite';

import { deleteStoredImage } from '@/utils/image-storage';

type PendingImageDeletion = {
  uri: string;
};

export type ImageCleanupResult = {
  deleted: number;
  deferred: number;
  failed: number;
};

export async function processPendingImageDeletions(
  db: SQLiteDatabase
): Promise<ImageCleanupResult> {
  const pendingImages =
    await db.getAllAsync<PendingImageDeletion>(
      `SELECT uri
       FROM pending_image_deletions
       ORDER BY queued_at ASC`
    );

  const result: ImageCleanupResult = {
    deleted: 0,
    deferred: 0,
    failed: 0,
  };

  for (const pendingImage of pendingImages) {
    const uri = pendingImage.uri;

    try {
      // Never delete an image still referenced by an item.
      const existingItem = await db.getFirstAsync<{
        id: number;
      }>(
        `SELECT id
         FROM items
         WHERE image_uri = ?
         LIMIT 1`,
        [uri]
      );

      if (existingItem) {
        result.deferred += 1;
        continue;
      }

      // Delete the actual file from Folio's storage.
      // This helper also checks the file location.
      deleteStoredImage(uri);

      // Only clear the queue after successful file cleanup.
      await db.runAsync(
        `DELETE FROM pending_image_deletions
         WHERE uri = ?`,
        [uri]
      );

      result.deleted += 1;
    } catch (error) {
      result.failed += 1;

      console.warn(
        'Folio could not clean up a stored image:',
        error
      );
    }
  }

  return result;
}
