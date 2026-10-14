import type { SQLiteDatabase } from 'expo-sqlite';

import { processPendingImageDeletions } from './image-cleanup';

export type ItemType = 'note' | 'link' | 'image';

export type NewItem = {
  type: ItemType;
  title: string;
  content: string;
  imageUri?: string | null;
  tags?: string[];
};

type ItemRow = {
  id: number;
  type: ItemType;
  title: string;
  content: string;
  image_uri: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
  is_archived: number;
  deleted_at: string | null;
};

export type SavedItem = Omit<
  ItemRow,
  'tags' | 'is_archived'
> & {
  tags: string[];
  is_archived: boolean;
};

const RECOVERY_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

// Convert a SQLite row into an item used by the app.
function toSavedItem(row: ItemRow): SavedItem {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    is_archived: row.is_archived === 1,
  };
}

// Reject invalid item IDs.
function validateItemId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid item ID.');
  }
}

// Validate and normalize website addresses.
export function normalizeWebUrl(input: string): string {
  const value = input.trim();

  if (!value) {
    throw new Error('Please enter a website URL.');
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
    ? value
    : `https://${value}`;

  try {
    const url = new URL(candidate);

    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      !url.hostname ||
      !url.hostname.includes('.')
    ) {
      throw new Error('Invalid website URL.');
    }

    return url.toString();
  } catch {
    throw new Error(
      'Please enter a valid website URL, such as https://github.com.'
    );
  }
}

// Process queued image files without failing an
// already committed database operation.
async function safelyCleanUpImages(
  db: SQLiteDatabase
): Promise<void> {
  try {
    const result = await processPendingImageDeletions(db);

    if (
      result.deleted > 0 ||
      result.deferred > 0 ||
      result.failed > 0
    ) {
      console.log(
        'Folio image cleanup:',
        result.deleted,
        'deleted,',
        result.deferred,
        'deferred,',
        result.failed,
        'failed'
      );
    }
  } catch (error) {
    // The pending deletion records stay in SQLite.
    // A later startup or foreground cleanup can retry.
    console.warn(
      'Folio could not process pending image deletions:',
      error
    );
  }
}

// Create a Note, Link, or Image.
export async function createItem(
  db: SQLiteDatabase,
  item: NewItem
): Promise<number> {
  const title = item.title.trim();

  const content =
    item.type === 'link'
      ? normalizeWebUrl(item.content)
      : item.content.trim();

  const imageUri = item.imageUri?.trim() || null;

  if (!title) {
    throw new Error('Please enter a title.');
  }

  if (item.type !== 'image' && !content) {
    throw new Error('Please enter some content.');
  }

  if (item.type === 'image' && !imageUri) {
    throw new Error('Please select an image.');
  }

  const tags = [
    ...new Set(
      (item.tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ];

  const timestamp = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO items
      (type, title, content, image_uri, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      item.type,
      title,
      content,
      imageUri,
      JSON.stringify(tags),
      timestamp,
      timestamp,
    ]
  );

  return result.lastInsertRowId;
}

// Retrieve items in the main Library.
export async function getInboxItems(
  db: SQLiteDatabase
): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE is_archived = 0
       AND deleted_at IS NULL
     ORDER BY created_at DESC, id DESC`
  );

  return rows.map(toSavedItem);
}

// Edit a Note in Library.
export async function updateNote(
  db: SQLiteDatabase,
  id: number,
  title: string,
  content: string,
  tags: string[]
): Promise<void> {
  validateItemId(id);

  const cleanTitle = title.trim();
  const cleanContent = content.trim();

  if (!cleanTitle || !cleanContent) {
    throw new Error('Title and content cannot be empty.');
  }

  const cleanTags = [
    ...new Set(
      tags.map((tag) => tag.trim()).filter(Boolean)
    ),
  ];

  const result = await db.runAsync(
    `UPDATE items
     SET title = ?,
         content = ?,
         tags = ?,
         updated_at = ?
     WHERE id = ?
       AND type = 'note'
       AND is_archived = 0
       AND deleted_at IS NULL`,
    [
      cleanTitle,
      cleanContent,
      JSON.stringify(cleanTags),
      new Date().toISOString(),
      id,
    ]
  );

  if (result.changes !== 1) {
    throw new Error(
      'Note not found in Library. It may have been archived or deleted.'
    );
  }
}

// Edit a Link in Library.
export async function updateLink(
  db: SQLiteDatabase,
  id: number,
  title: string,
  url: string,
  tags: string[]
): Promise<void> {
  validateItemId(id);

  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error('Please enter a link title.');
  }

  const cleanUrl = normalizeWebUrl(url);

  const cleanTags = [
    ...new Set(
      tags.map((tag) => tag.trim()).filter(Boolean)
    ),
  ];

  const result = await db.runAsync(
    `UPDATE items
     SET title = ?,
         content = ?,
         tags = ?,
         updated_at = ?
     WHERE id = ?
       AND type = 'link'
       AND is_archived = 0
       AND deleted_at IS NULL`,
    [
      cleanTitle,
      cleanUrl,
      JSON.stringify(cleanTags),
      new Date().toISOString(),
      id,
    ]
  );

  if (result.changes !== 1) {
    throw new Error(
      'Link not found in Library. It may have been archived or deleted.'
    );
  }
}

// Move an item from Library to Archive.
export async function archiveItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  validateItemId(id);

  const result = await db.runAsync(
    `UPDATE items
     SET is_archived = 1,
         updated_at = ?
     WHERE id = ?
       AND is_archived = 0
       AND deleted_at IS NULL`,
    [new Date().toISOString(), id]
  );

  if (result.changes !== 1) {
    throw new Error(
      'Item not found in Library or already archived.'
    );
  }
}

// Move an archived item back to Library.
export async function restoreItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  validateItemId(id);

  const result = await db.runAsync(
    `UPDATE items
     SET is_archived = 0,
         updated_at = ?
     WHERE id = ?
       AND is_archived = 1
       AND deleted_at IS NULL`,
    [new Date().toISOString(), id]
  );

  if (result.changes !== 1) {
    throw new Error(
      'Item not found in Archive or already restored.'
    );
  }
}

// Retrieve archived items.
export async function getArchivedItems(
  db: SQLiteDatabase
): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE is_archived = 1
       AND deleted_at IS NULL
     ORDER BY updated_at DESC, id DESC`
  );

  return rows.map(toSavedItem);
}

// Move an item to Recently Deleted.
// The image file is deliberately preserved.
export async function moveToRecentlyDeleted(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  validateItemId(id);

  const deletedAt = new Date().toISOString();

  const result = await db.runAsync(
    `UPDATE items
     SET deleted_at = ?,
         updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    [deletedAt, deletedAt, id]
  );

  if (result.changes !== 1) {
    throw new Error(
      'Item not found or already moved to Recently Deleted.'
    );
  }
}

// Retrieve items in Recently Deleted.
export async function getRecentlyDeletedItems(
  db: SQLiteDatabase
): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC, id DESC`
  );

  return rows.map(toSavedItem);
}

// Restore an item within its 30-day recovery period.
export async function restoreDeletedItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  validateItemId(id);

  const cutoffDate = new Date(
    Date.now() - RECOVERY_PERIOD_MS
  ).toISOString();

  const result = await db.runAsync(
    `UPDATE items
     SET deleted_at = NULL,
         updated_at = ?
     WHERE id = ?
       AND deleted_at IS NOT NULL
       AND deleted_at > ?`,
    [
      new Date().toISOString(),
      id,
      cutoffDate,
    ]
  );

  if (result.changes !== 1) {
    throw new Error(
      'Item not found or its 30-day recovery period has expired.'
    );
  }
}

// Permanently delete a trashed item.
//
// The SQLite transaction first records any image file
// needing cleanup. Physical deletion happens afterward.
export async function permanentlyDeleteItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  validateItemId(id);

  await db.withExclusiveTransactionAsync(async (txn) => {
    const item = await txn.getFirstAsync<{
      type: ItemType;
      image_uri: string | null;
    }>(
      `SELECT type, image_uri
       FROM items
       WHERE id = ?
         AND deleted_at IS NOT NULL`,
      [id]
    );

    if (!item) {
      throw new Error(
        'Item not found in Recently Deleted.'
      );
    }

    // Delete the SQLite record.
    const result = await txn.runAsync(
      `DELETE FROM items
       WHERE id = ?
         AND deleted_at IS NOT NULL`,
      [id]
    );

    if (result.changes !== 1) {
      throw new Error(
        'Could not permanently delete the item.'
      );
    }

    // Queue the physical file for deletion.
    if (item.type === 'image' && item.image_uri) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO pending_image_deletions
          (uri, queued_at)
         VALUES (?, ?)`,
        [
          item.image_uri,
          new Date().toISOString(),
        ]
      );
    }
  });

  // The transaction has now committed.
  // Remove queued files without holding the transaction open.
  await safelyCleanUpImages(db);
}

// Remove all items whose 30-day recovery period has ended.
//
// Expired images are queued and their files are processed
// after the SQLite transaction successfully commits.
export async function purgeExpiredDeletedItems(
  db: SQLiteDatabase,
  now: Date = new Date()
): Promise<number> {
  const cutoffDate = new Date(
    now.getTime() - RECOVERY_PERIOD_MS
  ).toISOString();

  let deletedCount = 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    // Queue the image files before deleting their records.
    await txn.runAsync(
      `INSERT OR IGNORE INTO pending_image_deletions
        (uri, queued_at)
       SELECT DISTINCT image_uri, ?
       FROM items
       WHERE type = 'image'
         AND image_uri IS NOT NULL
         AND LENGTH(TRIM(image_uri)) > 0
         AND deleted_at IS NOT NULL
         AND deleted_at <= ?`,
      [
        new Date().toISOString(),
        cutoffDate,
      ]
    );

    // Delete expired records from SQLite.
    const result = await txn.runAsync(
      `DELETE FROM items
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= ?`,
      [cutoffDate]
    );

    deletedCount = result.changes;
  });

  // Always process the pending queue, even when no new items
  // expired. This retries files left from earlier failures.
  await safelyCleanUpImages(db);

  return deletedCount;
}
