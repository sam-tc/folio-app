import type { SQLiteDatabase } from 'expo-sqlite';

import { processPendingImageDeletions } from './image-cleanup';

/**
 * Edit an image's metadata, optionally replacing the stored photo.
 * The database update and old-image cleanup queue are one transaction.
 */
export async function updateImageMetadata(
  db: SQLiteDatabase,
  id: number,
  title: string,
  description: string,
  tags: string[],
  replacementUri?: string
): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid image ID.');
  }

  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  const cleanReplacementUri = replacementUri?.trim();

  if (!cleanTitle) {
    throw new Error('Please enter an image title.');
  }

  if (replacementUri !== undefined && !cleanReplacementUri) {
    throw new Error('The replacement image could not be saved.');
  }

  const cleanTags = [
    ...new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
  ];

  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<{
      image_uri: string | null;
    }>(
      `SELECT image_uri FROM items
       WHERE id = ? AND type = 'image'
         AND is_archived = 0 AND deleted_at IS NULL`,
      [id]
    );

    if (!existing) {
      throw new Error(
        'Image not found in Library. It may have been archived or deleted.'
      );
    }

    const nextUri = cleanReplacementUri ?? existing.image_uri;

    if (!nextUri) {
      throw new Error('Image file is missing.');
    }

    const result = await txn.runAsync(
      `UPDATE items
       SET title = ?, content = ?, tags = ?,
           image_uri = ?, updated_at = ?
       WHERE id = ? AND type = 'image'
         AND is_archived = 0 AND deleted_at IS NULL`,
      [
        cleanTitle,
        cleanDescription,
        JSON.stringify(cleanTags),
        nextUri,
        new Date().toISOString(),
        id,
      ]
    );

    if (result.changes !== 1) {
      throw new Error('Could not save the image changes.');
    }

    // Queue the original file for deletion in the same
    // database transaction as the replacement.
    if (
      cleanReplacementUri &&
      existing.image_uri &&
      existing.image_uri !== cleanReplacementUri
    ) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO pending_image_deletions
          (uri, queued_at)
         VALUES (?, ?)`,
        [existing.image_uri, new Date().toISOString()]
      );
    }
  });

  // The database changes are now committed.
  // If cleanup fails, Folio can retry later.
  if (cleanReplacementUri) {
    try {
      await processPendingImageDeletions(db);
    } catch (error) {
      console.warn(
        'Image replacement cleanup will be retried:',
        error
      );
    }
  }
}
