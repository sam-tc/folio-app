import type { ItemType } from '@/database/items';
import { normalizeWebUrl } from '@/database/items';
import { supabase } from '@/lib/supabase';

export type CloudItem = {
  id: string;
  owner_id: string;
  type: ItemType;
  title: string;
  content: string;
  image_path: string | null;
  tags: string[];
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewCloudItem = {
  type: ItemType;
  title: string;
  content: string;
  tags?: string[];
  imagePath?: string | null;
};

export type CloudItemChanges = {
  title?: string;
  content?: string;
  tags?: string[];
  imagePath?: string | null;
};

export type CloudItemLocation =
  | 'inbox'
  | 'archive'
  | 'deleted';

function cleanTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ];
}

function checkItemId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid cloud item ID.');
  }
}

function checkImagePath(path: string): void {
  if (
    !path.trim() ||
    path.startsWith('file:') ||
    path.startsWith('content:')
  ) {
    throw new Error(
      'Images must be uploaded to private cloud storage first.'
    );
  }
}

async function requireSignedInUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      'Please sign in to access your cloud library.'
    );
  }

  return data.user;
}

// CREATE: Add a new item to the user's cloud library.
export async function createCloudItem(
  input: NewCloudItem
): Promise<CloudItem> {
  const user = await requireSignedInUser();

  const title = input.title.trim();
  const content =
    input.type === 'link'
      ? normalizeWebUrl(input.content)
      : input.content.trim();

  const imagePath = input.imagePath?.trim() || null;

  if (!title) {
    throw new Error('Please enter a title.');
  }

  if (input.type !== 'image' && !content) {
    throw new Error('Please enter some content.');
  }

  if (input.type === 'image') {
    if (!imagePath) {
      throw new Error(
        'Upload the image before saving its cloud record.'
      );
    }

    checkImagePath(imagePath);
  }

  const { data, error } = await supabase
    .from('folio_items')
    .insert({
      owner_id: user.id,
      type: input.type,
      title,
      content,
      image_path:
        input.type === 'image' ? imagePath : null,
      tags: cleanTags(input.tags ?? []),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Could not save item to the cloud: ${error.message}`
    );
  }

  return data as CloudItem;
}

// READ: Retrieve items from the requested section.
export async function getCloudItems(
  location: CloudItemLocation = 'inbox'
): Promise<CloudItem[]> {
  let query = supabase
    .from('folio_items')
    .select('*');

  if (location === 'inbox') {
    query = query
      .eq('is_archived', false)
      .is('deleted_at', null);
  } else if (location === 'archive') {
    query = query
      .eq('is_archived', true)
      .is('deleted_at', null);
  } else {
    query = query.not('deleted_at', 'is', null);
  }

  const { data, error } = await query.order(
    'created_at',
    { ascending: false }
  );

  if (error) {
    throw new Error(
      `Could not load cloud items: ${error.message}`
    );
  }

  return data as CloudItem[];
}

// READ BY ID: Used later for the security tests.
export async function getCloudItemById(
  id: string
): Promise<CloudItem | null> {
  checkItemId(id);

  const { data, error } = await supabase
    .from('folio_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load cloud item: ${error.message}`
    );
  }

  return data as CloudItem | null;
}

// UPDATE: Edit an existing cloud item's details.
export async function updateCloudItem(
  id: string,
  changes: CloudItemChanges
): Promise<CloudItem> {
  checkItemId(id);

  const existing = await getCloudItemById(id);

  if (!existing) {
    throw new Error(
      'This cloud item is unavailable or you do not have access.'
    );
  }

  if (existing.deleted_at || existing.is_archived) {
    throw new Error(
      'Restore the item to your library before editing it.'
    );
  }

  const title =
    changes.title === undefined
      ? existing.title
      : changes.title.trim();

  const content =
    changes.content === undefined
      ? existing.content
      : existing.type === 'link'
        ? normalizeWebUrl(changes.content)
        : changes.content.trim();

  const imagePath =
    changes.imagePath === undefined
      ? existing.image_path
      : changes.imagePath?.trim() || null;

  if (!title) {
    throw new Error('Please enter a title.');
  }

  if (existing.type !== 'image' && !content) {
    throw new Error('Please enter some content.');
  }

  if (existing.type === 'image') {
    if (!imagePath) {
      throw new Error('This image needs a cloud file.');
    }

    checkImagePath(imagePath);
  }

  const { data, error } = await supabase
    .from('folio_items')
    .update({
      title,
      content,
      image_path:
        existing.type === 'image' ? imagePath : null,
      tags:
        changes.tags === undefined
          ? existing.tags
          : cleanTags(changes.tags),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Could not update cloud item: ${error.message}`
    );
  }

  return data as CloudItem;
}

async function changeCloudStatus(
  id: string,
  changes: {
    is_archived?: boolean;
    deleted_at?: string | null;
  }
): Promise<CloudItem> {
  checkItemId(id);

  const { data, error } = await supabase
    .from('folio_items')
    .update({
      ...changes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Could not change item status: ${error.message}`
    );
  }

  return data as CloudItem;
}

// ARCHIVE: Remove an item from the main inbox.
export async function archiveCloudItem(
  id: string
): Promise<CloudItem> {
  return changeCloudStatus(id, {
    is_archived: true,
  });
}

// RESTORE FROM ARCHIVE: Return it to the inbox.
export async function unarchiveCloudItem(
  id: string
): Promise<CloudItem> {
  return changeCloudStatus(id, {
    is_archived: false,
  });
}

// TRASH: Soft-delete an item for later recovery.
export async function trashCloudItem(
  id: string
): Promise<CloudItem> {
  return changeCloudStatus(id, {
    deleted_at: new Date().toISOString(),
  });
}

// RECOVER: Move an item out of Recently Deleted.
export async function recoverCloudItem(
  id: string
): Promise<CloudItem> {
  return changeCloudStatus(id, {
    deleted_at: null,
  });
}

// DELETE: Permanently remove a cloud database record.
export async function permanentlyDeleteCloudItem(
  id: string
): Promise<void> {
  checkItemId(id);

  const { data, error } = await supabase
    .from('folio_items')
    .delete()
    .eq('id', id)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      `Could not permanently delete cloud item: ${
        error?.message ?? 'Item unavailable.'
      }`
    );
  }
}
