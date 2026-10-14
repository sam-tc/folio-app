import type { SQLiteDatabase } from 'expo-sqlite';

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

export type SavedItem = Omit<ItemRow, 'tags' | 'is_archived'> & {
  tags: string[];
  is_archived: boolean;
};

export async function createItem(
  db: SQLiteDatabase,
  item: NewItem
): Promise<number> {
  const title = item.title.trim();
  const content = item.content.trim();
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

  const tags = [...new Set(
    (item.tags ?? []).map(tag => tag.trim()).filter(Boolean)
  )];

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

export async function getInboxItems(
  db: SQLiteDatabase
): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
      `SELECT * FROM items
      WHERE is_archived = 0
        AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC`
  );

  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags) as string[],
    is_archived: row.is_archived === 1,
  }));
}

export async function updateNote(
  db: SQLiteDatabase,
  id: number,
  title: string,
  content: string,
  tags: string[]
): Promise<void> {
  const cleanTitle = title.trim();
  const cleanContent = content.trim();

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid note ID.');
  }

  if (!cleanTitle || !cleanContent) {
    throw new Error('Title and content cannot be empty.');
  }

  const cleanTags = [
    ...new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
  ];

  const result = await db.runAsync(
    `UPDATE items
     SET title = ?,
         content = ?,
         tags = ?,
         updated_at = ?
     WHERE id = ? AND type = 'note'`,
    [
      cleanTitle,
      cleanContent,
      JSON.stringify(cleanTags),
      new Date().toISOString(),
      id,
    ]
  );

  if (result.changes !== 1) {
    throw new Error('Note not found. It may have been deleted.');
  }
}



function validateItemId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid item ID.');
  }
}

export async function archiveItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  validateItemId(id);

  const result = await db.runAsync(
    `UPDATE items
     SET is_archived = 1, updated_at = ?
     WHERE id = ? AND is_archived = 0`,
    [new Date().toISOString(), id]
  );

  if (result.changes !== 1) {
    throw new Error('Item not found or already archived.');
  }
}

export async function restoreItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  validateItemId(id);

  const result = await db.runAsync(
    `UPDATE items
     SET is_archived = 0, updated_at = ?
     WHERE id = ? AND is_archived = 1`,
    [new Date().toISOString(), id]
  );

  if (result.changes !== 1) {
    throw new Error('Item not found or already restored.');
  }
}


export async function permanentlyDeleteItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  // Make sure the supplied item ID is valid.
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid item ID.');
  }

  // Only permanently delete items already in Recently Deleted.
  const result = await db.runAsync(
    `DELETE FROM items
     WHERE id = ?
       AND deleted_at IS NOT NULL`,
    [id]
  );

  // Check whether SQLite actually deleted one item.
  if (result.changes !== 1) {
    throw new Error(
      'Item not found in Recently Deleted.'
    );
  }
}


export async function purgeExpiredDeletedItems(
  db: SQLiteDatabase,
  now: Date = new Date()
): Promise<number> {
  // Calculate the timestamp exactly 30 days ago.
  const cutoffDate = new Date(
    now.getTime() - RECOVERY_PERIOD_MS
  ).toISOString();

  // Permanently delete only expired items.
  const result = await db.runAsync(
    `DELETE FROM items
     WHERE deleted_at IS NOT NULL
       AND deleted_at <= ?`,
    [cutoffDate]
  );

  // Return how many records were deleted.
  return result.changes;
}


export async function getArchivedItems(
  db: SQLiteDatabase
): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
        `SELECT * FROM items
        WHERE is_archived = 1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC, id DESC`
  );

  return rows.map((row) => ({
    ...row,
    tags: JSON.parse(row.tags) as string[],
    is_archived: row.is_archived === 1,
  }));
}


export async function moveToRecentlyDeleted(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid item ID.');
  }

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


export async function getRecentlyDeletedItems(
  db: SQLiteDatabase
): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC, id DESC`
  );

  return rows.map((row) => ({
    ...row,
    tags: JSON.parse(row.tags) as string[],
    is_archived: row.is_archived === 1,
  }));
}


const RECOVERY_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export async function restoreDeletedItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid item ID.');
  }

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
