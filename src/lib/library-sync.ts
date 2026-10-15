import type { SQLiteDatabase } from 'expo-sqlite';

import { downloadCloudImageItems } from '@/lib/download-image-items';
import { downloadCloudTextItems } from '@/lib/download-text-items';
import { supabase } from '@/lib/supabase';
import { syncPendingCloudDeletions } from '@/lib/sync-deletions';
import { syncPendingImageItems } from '@/lib/sync-image-items';
import { syncPendingTextItems } from '@/lib/sync-items';

const activeDatabases = new WeakSet<SQLiteDatabase>();

export type LibrarySyncResult = {
  deleted: number;

  uploaded: number;
  downloaded: number;
  refreshed: number;
  removed: number;
  skippedPending: number;

  imagesUploaded: number;
  imagesDownloaded: number;
  imagesRefreshed: number;
  imagesRemoved: number;
  imagesSkippedPending: number;
};

async function verifyCurrentUser(
  expectedUserId: string
): Promise<void> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      'Please sign in and connect to the internet to synchronize.'
    );
  }

  if (data.user.id !== expectedUserId) {
    throw new Error(
      'The signed-in account changed. Synchronization stopped.'
    );
  }
}

/**
 * Synchronize the authenticated user's Folio library.
 *
 * Order:
 * 1. Delete permanently removed cloud records.
 * 2. Upload pending notes and links.
 * 3. Upload pending images.
 * 4. Download cloud notes and links.
 * 5. Download cloud images and metadata.
 *
 * Local items are preserved if synchronization fails.
 */
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
    await verifyCurrentUser(expectedUserId);

    // 1. Process permanent deletions first.
    // This prevents deleted items from reappearing
    // when remote data is downloaded.
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
          'still need to synchronize.'
      );
    }

    await verifyCurrentUser(expectedUserId);

    // 2. Upload notes and links that changed locally.
    const textUploads = await syncPendingTextItems(db);

    if (textUploads.remaining > 0) {
      throw new Error(
        `${textUploads.remaining} note or link ` +
          'change(s) still need to upload.'
      );
    }

    await verifyCurrentUser(expectedUserId);

    // 3. Upload images and their metadata.
    const imageUploads = await syncPendingImageItems(
      db,
      expectedUserId
    );

    if (imageUploads.remaining > 0) {
      throw new Error(
        `${imageUploads.remaining} image(s) ` +
          'still need to upload.'
      );
    }

    await verifyCurrentUser(expectedUserId);

    // 4. Download notes and links.
    const textDownloads = await downloadCloudTextItems(
      db
    );

    await verifyCurrentUser(expectedUserId);

    // 5. Download images into persistent local storage.
    const imageDownloads = await downloadCloudImageItems(
      db,
      expectedUserId
    );

    await verifyCurrentUser(expectedUserId);

    return {
      deleted: deletions.deleted,

      uploaded: textUploads.uploaded,
      downloaded: textDownloads.downloaded,
      refreshed: textDownloads.refreshed,
      removed: textDownloads.removed,
      skippedPending: textDownloads.skippedPending,

      imagesUploaded: imageUploads.uploaded,
      imagesDownloaded: imageDownloads.downloaded,
      imagesRefreshed: imageDownloads.refreshed,
      imagesRemoved: imageDownloads.removed,
      imagesSkippedPending:
        imageDownloads.skippedPending,
    };
  } finally {
    // Release the synchronization lock even
    // when a network operation fails.
    activeDatabases.delete(db);
  }
}
