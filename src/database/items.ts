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

export async function deleteItem(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  validateItemId(id);

  const result = await db.runAsync(
    'DELETE FROM items WHERE id = ?',
    [id]
  );

  if (result.changes !== 1) {
    throw new Error('Item not found. It may already be deleted.');
  }
}


export async function getArchivedItems(
  db: SQLiteDatabase
): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE is_archived = 1
     ORDER BY updated_at DESC, id DESC`
  );

  return rows.map((row) => ({
    ...row,
    tags: JSON.parse(row.tags) as string[],
    is_archived: row.is_archived === 1,
  }));
}
