import type { SQLiteDatabase } from 'expo-sqlite';

import { deletePrivateImage } from '@/lib/cloud-images';
import { supabase } from '@/lib/supabase';

type PendingCloudDeletion = {
  cloud_id: string;
  cloud_image_path: string | null;
  queued_at: string;
};

export type CloudDeletionSyncResult = {
  deleted: number;
  failed: number;
  remaining: number;
  errors: string[];
};

/**
 * Process permanent deletion requests saved in SQLite.
 *
 * Important:
 * - The queue survives app restarts.
 * - Failed requests stay in the queue.
 * - A missing cloud record is safe to retry.
 * - Image files are deleted only after their
 *   cloud database record has been deleted.
 */
export async function syncPendingCloudDeletions(
  db: SQLiteDatabase,
  expectedUserId: string
): Promise<CloudDeletionSyncResult> {
  const { data, error: authError } =
    await supabase.auth.getUser();

  if (authError || !data.user) {
    throw new Error(
      'Please sign in before synchronizing deletions.'
    );
  }

  /*
   * The supplied database must belong to the same
   * account as the current Supabase session.
   *
   * This prevents an old synchronization operation
   * from processing another account's local queue.
   */
  if (data.user.id !== expectedUserId) {
    throw new Error(
      'The signed-in account changed. ' +
        'Cloud deletion synchronization was stopped.'
    );
  }

  const pending =
    await db.getAllAsync<PendingCloudDeletion>(`
      SELECT
        cloud_id,
        cloud_image_path,
        queued_at
      FROM pending_cloud_deletions
      ORDER BY queued_at ASC
    `);

  let deleted = 0;
  let failed = 0;

  const errors: string[] = [];

  for (const item of pending) {
    try {
      /*
       * First delete the Supabase database record.
       *
       * The authenticated user must own the record.
       * Supabase Row Level Security provides the
       * server-side ownership enforcement.
       *
       * Deleting a record that no longer exists
       * is treated as a successful retry.
       */
      const { error: deletionError } =
        await supabase
          .from('folio_items')
          .delete()
          .eq('id', item.cloud_id)
          .eq('owner_id', expectedUserId);

      if (deletionError) {
        throw new Error(
          `Cloud record deletion failed: ${
            deletionError.message
          }`
        );
      }

      /*
       * If this item has a private cloud image,
       * remove that file too.
       *
       * If image deletion fails, the request stays
       * queued and can be retried later.
       */
      if (item.cloud_image_path) {
        await deletePrivateImage(
          item.cloud_image_path
        );
      }

      /*
       * Remove the queue entry only after all
       * required cloud operations have succeeded.
       */
      await db.runAsync(
        `DELETE FROM pending_cloud_deletions
         WHERE cloud_id = ?`,
        [item.cloud_id]
      );

      deleted += 1;
    } catch (error) {
      failed += 1;

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown cloud deletion error.';

      errors.push(message);

      console.warn(
        'FOLIO CLOUD DELETE: RETAINED FOR RETRY',
        message
      );

      // Do not remove failed requests from SQLite.
    }
  }

  const remainingRow =
    await db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM pending_cloud_deletions`
    );

  return {
    deleted,
    failed,
    remaining: remainingRow?.total ?? 0,
    errors,
  };
}
