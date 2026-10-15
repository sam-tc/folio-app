import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  deletePrivateImage,
  uploadPrivateImage,
} from '@/lib/cloud-images';
import { supabase } from '@/lib/supabase';

type LocalImageItem = {
  id: number;
  cloud_id: string | null;
  cloud_image_path: string | null;
  type: 'image';
  title: string;
  content: string;
  image_uri: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
  is_archived: number;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced';
};

export type ImageUploadSyncResult = {
  uploaded: number;
  remaining: number;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      'Please sign in to synchronize your images.'
    );
  }

  return data.user.id;
}

function parseTags(value: string): string[] {
  const parsed: unknown = JSON.parse(value);

  if (
    !Array.isArray(parsed) ||
    !parsed.every((tag) => typeof tag === 'string')
  ) {
    throw new Error('Invalid saved image tags.');
  }

  return parsed;
}

async function readImage(
  db: SQLiteDatabase,
  id: number
): Promise<LocalImageItem | null> {
  return db.getFirstAsync<LocalImageItem>(
    `SELECT
       id,
       cloud_id,
       cloud_image_path,
       type,
       title,
       content,
       image_uri,
       tags,
       created_at,
       updated_at,
       is_archived,
       deleted_at,
       sync_status
     FROM items
     WHERE id = ?
       AND type = 'image'`,
    [id]
  );
}

/**
 * Upload pending local images to Supabase.
 *
 * This function:
 * - Preserves local image files.
 * - Reuses a stable cloud item ID.
 * - Reuses an already uploaded cloud image path.
 * - Leaves failed uploads pending for retry.
 *
 * It does not download images or remove local files.
 */
export async function syncPendingImageItems(
  db: SQLiteDatabase,
  expectedUserId: string
): Promise<ImageUploadSyncResult> {
  const userId = await requireUserId();

  if (userId !== expectedUserId) {
    throw new Error(
      'The signed-in account changed. Image sync stopped.'
    );
  }

  const pendingItems = await db.getAllAsync<{
    id: number;
  }>(`
    SELECT id
    FROM items
    WHERE type = 'image'
      AND sync_status = 'pending'
    ORDER BY created_at ASC, id ASC
  `);

  let uploaded = 0;

  for (const pending of pendingItems) {
    let item = await readImage(db, pending.id);

    if (!item || item.sync_status !== 'pending') {
      continue;
    }

    // Save a permanent UUID before making any
    // cloud request, so retries use the same ID.
    if (!item.cloud_id) {
      const cloudId = Crypto.randomUUID();

      await db.runAsync(
        `UPDATE items
         SET cloud_id = ?
         WHERE id = ?
           AND cloud_id IS NULL`,
        [cloudId, item.id]
      );

      item = await readImage(db, pending.id);
    }

    if (!item || !item.cloud_id) {
      throw new Error(
        'Could not assign a cloud ID to the image.'
      );
    }

    if (!item.image_uri) {
      throw new Error(
        `Image "${item.title}" has no local file.`
      );
    }

    let imagePath = item.cloud_image_path;

    if (!imagePath) {
      /*
       * Upload the image bytes only once.
       *
       * The returned private path is saved locally
       * before uploading the database record.
       *
       * If saving metadata to Supabase fails,
       * the next attempt can reuse this image path.
       */
      const newPath = await uploadPrivateImage(
        item.image_uri
      );

      const result = await db.runAsync(
        `UPDATE items
         SET cloud_image_path = ?
         WHERE id = ?
           AND cloud_id = ?
           AND cloud_image_path IS NULL`,
        [newPath, item.id, item.cloud_id]
      );

      if (result.changes !== 1) {
        // The image may have been deleted or
        // changed while its upload was running.
        // Avoid retaining an unnecessary cloud copy.
        try {
          await deletePrivateImage(newPath);
        } catch (cleanupError) {
          console.warn(
            'Could not remove unused cloud image:',
            cleanupError
          );
        }

        throw new Error(
          'The local image changed during upload. Please retry.'
        );
      }

      imagePath = newPath;
    }

    if (!imagePath.startsWith(`${userId}/`)) {
      throw new Error(
        'The cloud image does not belong to this account.'
      );
    }

    /*
     * Reload the latest metadata after uploading
     * the file, because the user may have changed
     * the title or tags during the network request.
     */
    item = await readImage(db, pending.id);

    if (!item || item.sync_status !== 'pending') {
      continue;
    }

    if (!item.cloud_id || !item.cloud_image_path) {
      throw new Error(
        'The image is missing its cloud identity.'
      );
    }

    const tags = parseTags(item.tags);

    const { error } = await supabase
      .from('folio_items')
      .upsert(
        {
          id: item.cloud_id,
          owner_id: userId,
          type: 'image',
          title: item.title,
          content: item.content,
          image_path: item.cloud_image_path,
          tags,
          is_archived: item.is_archived === 1,
          deleted_at: item.deleted_at,
          created_at: item.created_at,
          updated_at: item.updated_at,
        },
        {
          onConflict: 'id',
        }
      );

    if (error) {
      // Keep the local record pending.
      // Its cloud image path is already saved.
      throw new Error(
        `Could not synchronize image "${item.title}": ` +
          error.message
      );
    }

    /*
     * Mark the item synchronized only if its
     * content and image haven't changed during
     * the cloud request.
     *
     * Otherwise, the next sync will upload
     * its newer metadata.
     */
    const result = await db.runAsync(
      `UPDATE items
       SET sync_status = 'synced'
       WHERE id = ?
         AND cloud_id = ?
         AND cloud_image_path = ?
         AND image_uri = ?
         AND updated_at = ?
         AND sync_status = 'pending'`,
      [
        item.id,
        item.cloud_id,
        item.cloud_image_path,
        item.image_uri,
        item.updated_at,
      ]
    );

    if (result.changes === 1) {
      uploaded += 1;
    }
  }

  const remainingRow = await db.getFirstAsync<{
    count: number;
  }>(
    `SELECT COUNT(*) AS count
     FROM items
     WHERE type = 'image'
       AND sync_status = 'pending'`
  );

  return {
    uploaded,
    remaining: remainingRow?.count ?? 0,
  };
}
