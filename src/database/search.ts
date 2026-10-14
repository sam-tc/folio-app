import type { SQLiteDatabase } from 'expo-sqlite';
import type { SavedItem } from './items';

export type LibraryFilter =
  | 'all'
  | 'note'
  | 'link'
  | 'image'
  | 'tagged';

type SearchRow = Omit<
  SavedItem,
  'tags' | 'is_archived'
> & {
  tags: string;
  is_archived: number;
};

export async function searchLibraryItems(
  db: SQLiteDatabase,
  searchText: string,
  filter: LibraryFilter
): Promise<SavedItem[]> {
  const search = searchText.trim().toLowerCase();

  // Only search items in the active Library.
  const conditions: string[] = [
    'is_archived = 0',
    'deleted_at IS NULL',
  ];

  const parameters: string[] = [];

  // Apply the selected item type filter.
  if (
    filter === 'note' ||
    filter === 'link' ||
    filter === 'image'
  ) {
    conditions.push('type = ?');
    parameters.push(filter);
  }

  // Show only items that have at least one tag.
  if (filter === 'tagged') {
    conditions.push("tags <> '[]'");
  }

  // Search titles, content, URLs, and stored tags.
  if (search.length > 0) {
    conditions.push(`
      (
        instr(lower(title), ?) > 0
        OR instr(lower(content), ?) > 0
        OR instr(lower(tags), ?) > 0
      )
    `);

    // Also support searches such as #college.
    const tagSearch = search.startsWith('#')
      ? search.slice(1)
      : search;

    parameters.push(search, search, tagSearch);
  }

  const rows = await db.getAllAsync<SearchRow>(
    `SELECT *
     FROM items
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC`,
    parameters
  );

  return rows.map((row) => ({
    ...row,
    tags: JSON.parse(row.tags) as string[],
    is_archived: row.is_archived === 1,
  }));
}
