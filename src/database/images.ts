import type { SQLiteDatabase } from 'expo-sqlite';

export async function updateImageMetadata(
  db: SQLiteDatabase,
  id: number,
  title: string,
  description: string,
  tags: string[]
): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid image ID.');
  }

  const cleanTitle = title.trim();
  const cleanDescription = description.trim();

  if (!cleanTitle) {
    throw new Error('Please enter an image title.');
  }

  const cleanTags = [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ];

  const result = await db.runAsync(
    `UPDATE items
     SET title = ?,
         content = ?,
         tags = ?,
         updated_at = ?
     WHERE id = ?
       AND type = 'image'
       AND is_archived = 0
       AND deleted_at IS NULL`,
    [
      cleanTitle,
      cleanDescription,
      JSON.stringify(cleanTags),
      new Date().toISOString(),
      id,
    ]
  );

  if (result.changes !== 1) {
    throw new Error(
      'Image not found in Library. It may have been archived or deleted.'
    );
  }
}
