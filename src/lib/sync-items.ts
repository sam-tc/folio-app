import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { supabase } from '@/lib/supabase';

type LocalTextItem = {
  id: number;
  cloud_id: string | null;
  type: 'note' | 'link';
  title: string;
  content: string;
  tags: string;
  is_archived: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
};

export type TextSyncResult = {
  uploaded: number;
  remaining: number;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      'Sign in and connect to the internet to synchronize your library.'
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
    throw new Error('Invalid saved tags.');
  }

  return parsed;
}

/**
 * Upload pending notes and links from SQLite to Supabase.
 *
 * This function is intentionally limited to text items.
 * Image synchronization will use the private storage
 * service that we have already tested.
 *
 * It does not remove or overwrite local records.
 */
export async function syncPendingTextItems(
  db: SQLiteDatabase
): Promise<TextSyncResult> {
  const userId = await requireUserId();

  const pendingItems =
    await db.getAllAsync<LocalTextItem>(`
      SELECT
        id,
        cloud_id,
        type,
        title,
        content,
        tags,
        is_archived,
        deleted_at,
        created_at,
        updated_at,
        sync_status
      FROM items
      WHERE sync_status = 'pending'
        AND type IN ('note', 'link')
      ORDER BY created_at ASC, id ASC
    `);

  let uploaded = 0;

  for (const pendingItem of pendingItems) {
    /*
     * Generate a stable cloud ID before uploading.
     *
     * If the network fails, this ID remains in SQLite.
     * A later retry uses the same ID rather than
     * creating another cloud record.
     */
    if (!pendingItem.cloud_id) {
      const generatedId = Crypto.randomUUID();

      await db.runAsync(
        `UPDATE items
         SET cloud_id = ?
         WHERE id = ?
           AND cloud_id IS NULL`,
        [generatedId, pendingItem.id]
      );
    }

    // Read the latest saved version of this item.
    const item =
      await db.getFirstAsync<LocalTextItem>(
        `SELECT
           id,
           cloud_id,
           type,
           title,
           content,
           tags,
           is_archived,
           deleted_at,
           created_at,
           updated_at,
           sync_status
         FROM items
         WHERE id = ?`,
        [pendingItem.id]
      );

    if (!item || item.sync_status !== 'pending') {
      continue;
    }

    if (!item.cloud_id) {
      throw new Error(
        'Could not assign a cloud ID to a saved item.'
      );
    }

    const tags = parseTags(item.tags);

    /*
     * Upsert means:
     *
     * - Insert when this ID does not yet exist.
     * - Update when this ID already exists.
     *
     * Retrying an upload therefore targets the same
     * record instead of creating duplicates.
     */
    const { error } = await supabase
      .from('folio_items')
      .upsert(
        {
          id: item.cloud_id,
          owner_id: userId,
          type: item.type,
          title: item.title,
          content: item.content,
          image_path: null,
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
      // Leave the local record pending for a future retry.
      throw new Error(
        `Could not synchronize "${item.title}": ${error.message}`
      );
    }

    /*
     * Only mark the item synchronized if it has not
     * changed since the upload started.
     *
     * If the user edited it during the network request,
     * its newer version must remain pending.
     */
    const result = await db.runAsync(
      `UPDATE items
       SET sync_status = 'synced'
       WHERE id = ?
         AND cloud_id = ?
         AND updated_at = ?
         AND sync_status = 'pending'`,
      [
        item.id,
        item.cloud_id,
        item.updated_at,
      ]
    );

    if (result.changes === 1) {
      uploaded += 1;
    }
  }

  const remainingRow =
    await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM items
       WHERE sync_status = 'pending'
         AND type IN ('note', 'link')`
    );

  return {
    uploaded,
    remaining: remainingRow?.count ?? 0,
  };
}
