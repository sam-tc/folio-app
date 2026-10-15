import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

const IMAGE_BUCKET = 'folio-images';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const imageFormats: Record<
  string,
  { mimeType: string; extension: string }
> = {
  jpg: {
    mimeType: 'image/jpeg',
    extension: 'jpg',
  },
  jpeg: {
    mimeType: 'image/jpeg',
    extension: 'jpg',
  },
  png: {
    mimeType: 'image/png',
    extension: 'png',
  },
  webp: {
    mimeType: 'image/webp',
    extension: 'webp',
  },
  heic: {
    mimeType: 'image/heic',
    extension: 'heic',
  },
  heif: {
    mimeType: 'image/heif',
    extension: 'heif',
  },
};

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      'Please sign in to access your cloud images.'
    );
  }

  return data.user.id;
}

function getImageFormat(uri: string) {
  const pathname = uri.split('?')[0];
  const extension = pathname
    .split('.')
    .pop()
    ?.toLowerCase();

  const format = extension
    ? imageFormats[extension]
    : undefined;

  if (!format) {
    throw new Error(
      'Unsupported image format. Choose a JPG, PNG, WebP, HEIC or HEIF image.'
    );
  }

  return format;
}

async function validateOwnImagePath(
  path: string
): Promise<void> {
  const userId = await getCurrentUserId();

  if (
    !path.startsWith(`${userId}/`) ||
    path.includes('..') ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#') ||
    path.endsWith('/')
  ) {
    throw new Error(
      'You cannot access this image path.'
    );
  }
}

// Upload an image from the device into private storage.
export async function uploadPrivateImage(
  localUri: string
): Promise<string> {
  if (!localUri.startsWith('file://')) {
    throw new Error(
      'Please select a locally stored image.'
    );
  }

  const userId = await getCurrentUserId();
  const format = getImageFormat(localUri);

  const file = new File(localUri);

  if (!file.exists) {
    throw new Error(
      'The selected image could not be found.'
    );
  }

  if (file.size === 0) {
    throw new Error('The selected image is empty.');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      'This image is too large. Choose one smaller than 15 MB.'
    );
  }

  const imageData = await file.arrayBuffer();

  const uniqueName =
    `${Date.now()}-` +
    `${Math.random().toString(36).slice(2, 12)}`;

  const path =
    `${userId}/${uniqueName}.${format.extension}`;

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, imageData, {
      contentType: format.mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Image upload failed: ${error.message}`
    );
  }

  // Store this path in the cloud database,
  // not the local file URI.
  return path;
}

// Get a temporary URL to display a private image.
export async function getPrivateImageUrl(
  path: string
): Promise<string> {
  await validateOwnImagePath(path);

  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrl(path, 10 * 60);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Could not open cloud image: ${
        error?.message ?? 'Unknown error'
      }`
    );
  }

  // This URL expires after 10 minutes.
  return data.signedUrl;
}

// Delete a cloud image when it is no longer needed.
export async function deletePrivateImage(
  path: string
): Promise<void> {
  await validateOwnImagePath(path);

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(
      `Could not delete cloud image: ${error.message}`
    );
  }
}
