import type { SQLiteDatabase } from 'expo-sqlite';

import type { CloudItem } from '@/lib/cloud-items';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 200;

type CloudTextItem = CloudItem & {
  type: 'note' | 'link';
};

type LocalSyncRow = {
  id: number;
  sync_status: 'pending' | 'synced';
};

type SyncedLocalRow = {
  id: number;
  cloud_id: string;
};

export type DownloadTextResult = {
  downloaded: number;
  refreshed: number;
  skippedPending: number;
  removed: number;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      'Please sign in to download your cloud library.'
    );
  }

  return data.user.id;
}

async function fetchCloudTextItems(
  userId: string
): Promise<CloudTextItem[]> {
  const items: CloudTextItem[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('folio_items')
      .select('*')
      .eq('owner_id', userId)
      .in('type', ['note', 'link'])
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Could not download your cloud library: ${error.message}`
      );
    }

    const page = (data ?? []) as CloudTextItem[];
    items.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return items;
}

/**
 * Download notes and links from Supabase.
 *
 * Preserve unsynchronized local edits, avoid duplicates,
 * and remove local copies of records that have already
 * been permanently deleted in the cloud.
 *
 * Call this only after pending cloud deletions and
 * pending text uploads have been processed.
 */
export async function downloadCloudTextItems(
  db: SQLiteDatabase
): Promise<DownloadTextResult> {
  const userId = await requireUserId();

  // Never reconcile deletions while local requests
  // are still waiting to be sent to Supabase.
  const pendingDeletion = await db.getFirstAsync<{
    total: number;
  }>(`
    SELECT COUNT(*) AS total
    FROM pending_cloud_deletions
  `);

  if ((pendingDeletion?.total ?? 0) > 0) {
    throw new Error(
      'Cloud deletions must finish before downloading.'
    );
  }

  // Fetch all cloud records before modifying SQLite.
  // An unsuccessful request leaves local data untouched.
  const cloudItems = await fetchCloudTextItems(userId);

  const cloudIds = new Set(
    cloudItems.map((item) => item.id)
  );

  let downloaded = 0;
  let refreshed = 0;
  let skippedPending = 0;
  let removed = 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const item of cloudItems) {
      const existing =
        await txn.getFirstAsync<LocalSyncRow>(
          `SELECT id, sync_status
           FROM items
           WHERE cloud_id = ?`,
          [item.id]
        );

      // Never overwrite an offline local edit.
      if (existing?.sync_status === 'pending') {
        skippedPending += 1;
        continue;
      }

      const tags = JSON.stringify(item.tags ?? []);
      const archived = item.is_archived ? 1 : 0;

      if (existing) {
        await txn.runAsync(
          `UPDATE items
           SET title = ?,
               content = ?,
               tags = ?,
               is_archived = ?,
               deleted_at = ?,
               created_at = ?,
               updated_at = ?,
               sync_status = 'synced'
           WHERE id = ?
             AND sync_status = 'synced'`,
          [
            item.title,
            item.content,
            tags,
            archived,
            item.deleted_at,
            item.created_at,
            item.updated_at,
            existing.id,
          ]
        );

        // Version 5 marks content changes as pending.
        // This update came FROM Supabase, so reset it
        // inside the same transaction.
        await txn.runAsync(
          `UPDATE items
           SET sync_status = 'synced'
           WHERE id = ?`,
          [existing.id]
        );

        refreshed += 1;
      } else {
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
             ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, 'synced'
           )`,
          [
            item.type,
            item.title,
            item.content,
            tags,
            item.created_at,
            item.updated_at,
            archived,
            item.deleted_at,
            item.id,
          ]
        );

        downloaded += 1;
      }
    }

    // Find local notes and links previously confirmed
    // as synchronized with Supabase.
    const syncedLocalItems =
      await txn.getAllAsync<SyncedLocalRow>(`
        SELECT id, cloud_id
        FROM items
        WHERE cloud_id IS NOT NULL
          AND sync_status = 'synced'
          AND type IN ('note', 'link')
      `);

    for (const item of syncedLocalItems) {
      if (cloudIds.has(item.cloud_id)) {
        continue;
      }

      /*
       * This item was previously synchronized but
       * no longer exists in the cloud results.
       *
       * Remove its local copy so an item permanently
       * deleted on another device does not reappear.
       *
       * Clear cloud_id first so the local deletion
       * trigger does not queue another remote deletion
       * for an already-absent cloud item.
       */
      await txn.runAsync(
        `UPDATE items
         SET cloud_id = NULL
         WHERE id = ?
           AND sync_status = 'synced'`,
        [item.id]
      );

      const result = await txn.runAsync(
        `DELETE FROM items
         WHERE id = ?
           AND cloud_id IS NULL
           AND sync_status = 'synced'`,
        [item.id]
      );

      removed += result.changes;
    }
  });

  return {
    downloaded,
    refreshed,
    skippedPending,
    removed,
  };
}
