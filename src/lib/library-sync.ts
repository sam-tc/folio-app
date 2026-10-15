import type { SQLiteDatabase } from 'expo-sqlite';

import { downloadCloudTextItems } from '@/lib/download-text-items';
import { supabase } from '@/lib/supabase';
import { syncPendingCloudDeletions } from '@/lib/sync-deletions';
import { syncPendingTextItems } from '@/lib/sync-items';

const activeDatabases = new WeakSet<SQLiteDatabase>();

export type LibrarySyncResult = {
  deleted: number;
  uploaded: number;
  downloaded: number;
  refreshed: number;
  removed: number;
  skippedPending: number;
};

export async function synchronizeLibrary(
  db: SQLiteDatabase,
  expectedUserId: string
): Promise<LibrarySyncResult> {
  if (activeDatabases.has(db)) {
    throw new Error(
      'Library synchronization is already running.'
    );
  }

  activeDatabases.add(db);

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw new Error(
        'Please sign in and connect to the internet to sync.'
      );
    }

    if (data.user.id !== expectedUserId) {
      throw new Error(
        'The signed-in account changed. Sync was stopped.'
      );
    }

    // Step 1: Complete permanent cloud deletions first.
    // This prevents deleted records from being downloaded
    // into the local Library again.
    const deletions = await syncPendingCloudDeletions(
      db,
      expectedUserId
    );

    if (
      deletions.failed > 0 ||
      deletions.remaining > 0
    ) {
      throw new Error(
        `${deletions.remaining} cloud deletion(s) ` +
          'still need to synchronize. Local data is preserved.'
      );
    }

    // Step 2: Upload pending local notes and links.
    const uploads = await syncPendingTextItems(db);

    if (uploads.remaining > 0) {
      throw new Error(
        `${uploads.remaining} item(s) still need to upload.`
      );
    }

    // Confirm the account hasn't changed during uploads.
    const { data: current, error: sessionError } =
      await supabase.auth.getUser();

    if (
      sessionError ||
      current.user?.id !== expectedUserId
    ) {
      throw new Error(
        'The signed-in account changed during sync.'
      );
    }

    // Step 3: Download remote notes and links.
    const downloads = await downloadCloudTextItems(db);

    return {
      deleted: deletions.deleted,
      uploaded: uploads.uploaded,
      downloaded: downloads.downloaded,
      refreshed: downloads.refreshed,
      removed: downloads.removed,
      skippedPending: downloads.skippedPending,
    };
  } finally {
    // Always release the synchronization lock,
    // including when a network request fails.
    activeDatabases.delete(db);
  }
}
