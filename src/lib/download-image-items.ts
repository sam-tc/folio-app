import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { processPendingImageDeletions } from '@/database/image-cleanup';
import { downloadPrivateImage } from '@/lib/cloud-images';
import { supabase } from '@/lib/supabase';
import { deleteStoredImage } from '@/utils/image-storage';

const PAGE_SIZE = 200;

type CloudImageItem = {
  id: string;
  owner_id: string;
  type: 'image';
  title: string;
  content: string;
  image_path: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  deleted_at: string | null;
};

type LocalImageRow = {
  id: number;
  type: string;
  image_uri: string | null;
  cloud_image_path: string | null;
  sync_status: 'pending' | 'synced';
};

type SyncedImageRow = {
  id: number;
  cloud_id: string;
  image_uri: string | null;
};

export type ImageDownloadSyncResult = {
  downloaded: number;
  refreshed: number;
  skippedPending: number;
  removed: number;
};

function localFileExists(uri: string | null): boolean {
  if (!uri || !uri.startsWith('file://')) {
    return false;
  }

  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      'Please sign in to download your cloud images.'
    );
  }

  return data.user.id;
}

async function fetchCloudImages(
  userId: string
): Promise<CloudImageItem[]> {
  const images: CloudImageItem[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('folio_items')
      .select('*')
      .eq('owner_id', userId)
      .eq('type', 'image')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Could not load cloud images: ${error.message}`
      );
    }

    const page = (data ?? []) as CloudImageItem[];

    images.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return images;
}

async function requireNoPendingDeletions(
  db: SQLiteDatabase
): Promise<void> {
  const row = await db.getFirstAsync<{
    total: number;
  }>(
    `SELECT COUNT(*) AS total
     FROM pending_cloud_deletions`
  );

  if ((row?.total ?? 0) > 0) {
    throw new Error(
      'Pending cloud deletions must finish before downloading images.'
    );
  }
}

async function cleanUpUnusedDownload(
  uri: string | null
): Promise<void> {
  if (!uri) {
    return;
  }

  try {
    deleteStoredImage(uri);
  } catch (error) {
    console.warn(
      'Could not remove an unused image download:',
      error
    );
  }
}

/**
 * Download cloud images into Folio's local SQLite library.
 *
 * Safety:
 * - Never overwrite pending local edits.
 * - Match records by cloud UUID.
 * - Reuse existing local image files.
 * - Download missing files for offline use.
 * - Preserve local originals until a replacement is saved.
 * - Remove synchronized images deleted on another device.
 */
export async function downloadCloudImageItems(
  db: SQLiteDatabase,
  expectedUserId: string
): Promise<ImageDownloadSyncResult> {
  const userId = await requireUserId();

  if (userId !== expectedUserId) {
    throw new Error(
      'The signed-in account changed. Image download stopped.'
    );
  }

  await requireNoPendingDeletions(db);

  // Fetch the complete cloud list before reconciling
  // local records. A network error cannot be mistaken
  // for an empty cloud library.
  const cloudImages = await fetchCloudImages(userId);

  const remoteIds = new Set(
    cloudImages.map((image) => image.id)
  );

  let downloaded = 0;
  let refreshed = 0;
  let skippedPending = 0;
  let removed = 0;

  for (const image of cloudImages) {
    if (!image.image_path) {
      throw new Error(
        `Cloud image "${image.title}" is missing its storage path.`
      );
    }

    const existing = await db.getFirstAsync<LocalImageRow>(
      `SELECT
         id,
         type,
         image_uri,
         cloud_image_path,
         sync_status
       FROM items
       WHERE cloud_id = ?`,
      [image.id]
    );

    if (existing && existing.type !== 'image') {
      throw new Error(
        'A cloud image conflicts with an existing local item.'
      );
    }

    if (existing?.sync_status === 'pending') {
      skippedPending += 1;
      continue;
    }

    // A cloud image must be downloaded if it has
    // never existed locally, its path changed,
    // or the previously downloaded file is missing.
    const needsDownload =
      !existing ||
      existing.cloud_image_path !== image.image_path ||
      !localFileExists(existing.image_uri);

    let newLocalUri: string | null = null;
    let usedNewDownload = false;

    try {
      if (needsDownload) {
        newLocalUri = await downloadPrivateImage(
          image.image_path
        );
      }

      await db.withExclusiveTransactionAsync(
        async (txn) => {
          const pendingDeletion =
            await txn.getFirstAsync<{
              total: number;
            }>(
              `SELECT COUNT(*) AS total
               FROM pending_cloud_deletions`
            );

          if ((pendingDeletion?.total ?? 0) > 0) {
            throw new Error(
              'A cloud deletion is waiting to synchronize.'
            );
          }

          // Recheck the record because a user might
          // edit or delete an item during the download.
          const current =
            await txn.getFirstAsync<LocalImageRow>(
              `SELECT
                 id,
                 type,
                 image_uri,
                 cloud_image_path,
                 sync_status
               FROM items
               WHERE cloud_id = ?`,
              [image.id]
            );

          if (current?.sync_status === 'pending') {
            skippedPending += 1;
            return;
          }

          if (
            existing &&
            current &&
            (
              existing.image_uri !== current.image_uri ||
              existing.cloud_image_path !==
                current.cloud_image_path
            )
          ) {
            // Another operation already changed
            // the local image. Retry on a later sync.
            return;
          }

          const localUri =
            newLocalUri ?? current?.image_uri ?? null;

          if (!localFileExists(localUri)) {
            throw new Error(
              `A local copy of "${image.title}" is unavailable.`
            );
          }

          const tags = JSON.stringify(
            image.tags ?? []
          );

          const archived = image.is_archived ? 1 : 0;

          if (current) {
            await txn.runAsync(
              `UPDATE items
               SET title = ?,
                   content = ?,
                   tags = ?,
                   is_archived = ?,
                   deleted_at = ?,
                   image_uri = ?,
                   cloud_image_path = ?,
                   created_at = ?,
                   updated_at = ?,
                   sync_status = 'synced'
               WHERE id = ?
                 AND sync_status = 'synced'`,
              [
                image.title,
                image.content,
                tags,
                archived,
                image.deleted_at,
                localUri,
                image.image_path,
                image.created_at,
                image.updated_at,
                current.id,
              ]
            );

            // Version 5's trigger marks content updates
            // pending. This update came FROM Supabase,
            // so reset that status in the transaction.
            await txn.runAsync(
              `UPDATE items
               SET sync_status = 'synced'
               WHERE id = ?`,
              [current.id]
            );

            // Preserve the old photo until SQLite has
            // committed its replacement. Then the
            // existing cleanup queue can remove it.
            if (
              newLocalUri &&
              current.image_uri &&
              current.image_uri !== newLocalUri
            ) {
              await txn.runAsync(
                `INSERT OR IGNORE INTO
                   pending_image_deletions
                   (uri, queued_at)
                 VALUES (?, ?)`,
                [
                  current.image_uri,
                  new Date().toISOString(),
                ]
              );
            }

            refreshed += 1;
          } else {
            if (!newLocalUri) {
              throw new Error(
                'New cloud image has no downloaded file.'
              );
            }

            await txn.runAsync(
              `INSERT INTO items (
                 type,
                 title,
                 content,
                 image_uri,
                 tags,
                 created_at,
                 updated_at,
                 is_archived,
                 deleted_at,
                 cloud_id,
                 cloud_image_path,
                 sync_status
               )
               VALUES (
                 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 'synced'
               )`,
              [
                image.title,
                image.content,
                newLocalUri,
                tags,
                image.created_at,
                image.updated_at,
                archived,
                image.deleted_at,
                image.id,
                image.image_path,
              ]
            );

            downloaded += 1;
          }

          if (newLocalUri) {
            usedNewDownload = true;
          }
        }
      );
    } catch (error) {
      if (newLocalUri && !usedNewDownload) {
        await cleanUpUnusedDownload(newLocalUri);
      }

      throw error;
    }

    // A download that was skipped because of a
    // concurrent local change must not be retained.
    if (newLocalUri && !usedNewDownload) {
      await cleanUpUnusedDownload(newLocalUri);
    }
  }

  // Reconcile images permanently deleted elsewhere.
  // Only already-synced records can be removed.
  await db.withExclusiveTransactionAsync(async (txn) => {
    const pendingDeletion =
      await txn.getFirstAsync<{
        total: number;
      }>(
        `SELECT COUNT(*) AS total
         FROM pending_cloud_deletions`
      );

    if ((pendingDeletion?.total ?? 0) > 0) {
      throw new Error(
        'Cloud deletions must complete before reconciliation.'
      );
    }

    const localImages =
      await txn.getAllAsync<SyncedImageRow>(
        `SELECT id, cloud_id, image_uri
         FROM items
         WHERE type = 'image'
           AND cloud_id IS NOT NULL
           AND sync_status = 'synced'`
      );

    for (const local of localImages) {
      if (remoteIds.has(local.cloud_id)) {
        continue;
      }

      // Clearing the cloud ID prevents the DELETE
      // trigger from queuing another remote deletion.
      await txn.runAsync(
        `UPDATE items
         SET cloud_id = NULL
         WHERE id = ?
           AND sync_status = 'synced'`,
        [local.id]
      );

      const result = await txn.runAsync(
        `DELETE FROM items
         WHERE id = ?
           AND cloud_id IS NULL
           AND sync_status = 'synced'`,
        [local.id]
      );

      if (result.changes === 1) {
        if (local.image_uri) {
          await txn.runAsync(
            `INSERT OR IGNORE INTO
               pending_image_deletions
               (uri, queued_at)
             VALUES (?, ?)`,
            [
              local.image_uri,
              new Date().toISOString(),
            ]
          );
        }

        removed += 1;
      }
    }
  });

  // Retry local file cleanup after successful
  // database reconciliation. Failures remain queued.
  try {
    await processPendingImageDeletions(db);
  } catch (error) {
    console.warn(
      'Image cleanup will be retried later:',
      error
    );
  }

  return {
    downloaded,
    refreshed,
    skippedPending,
    removed,
  };
}
