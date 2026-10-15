import * as Crypto from 'expo-crypto';
import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import { supabase } from '@/lib/supabase';

const IMAGE_BUCKET = 'folio-images';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const imageDirectory = new Directory(
  Paths.document,
  'folio-images'
);

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
  gif: {
    mimeType: 'image/gif',
    extension: 'gif',
  },
  avif: {
    mimeType: 'image/avif',
    extension: 'avif',
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
      'Unsupported image format. Choose a JPG, PNG, ' +
        'WebP, HEIC, HEIF, GIF or AVIF image.'
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

// Upload a locally saved photo to private Supabase Storage.
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

  const uniqueName = Crypto.randomUUID();

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

  // Return the private storage path, not a public URL.
  return path;
}

// Generate a temporary URL for an authenticated image.
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

  return data.signedUrl;
}

/**
 * Download a cloud image into Folio's persistent
 * local image directory.
 *
 * Unlike a signed URL, this local file remains
 * available after the URL expires and while offline.
 *
 * It also uses the same directory as Stage 1,
 * so the existing image-cleanup helper can manage
 * downloaded files when they're no longer needed.
 */
export async function downloadPrivateImage(
  path: string
): Promise<string> {
  await validateOwnImagePath(path);

  const format = getImageFormat(path);

  const signedUrl = await getPrivateImageUrl(path);

  imageDirectory.create({
    idempotent: true,
    intermediates: true,
  });

  const filename =
    `folio-cloud-${Crypto.randomUUID()}` +
    `.${format.extension}`;

  const destination = new File(
    imageDirectory,
    filename
  );

  try {
    const downloaded = await File.downloadFileAsync(
      signedUrl,
      destination
    );

    if (
      !downloaded.exists ||
      downloaded.size === 0
    ) {
      throw new Error(
        'The downloaded cloud image is empty.'
      );
    }

    return downloaded.uri;
  } catch (error) {
    // Never leave a failed or partial download behind.
    if (destination.exists) {
      try {
        destination.delete();
      } catch (cleanupError) {
        console.warn(
          'Could not clean up incomplete cloud download:',
          cleanupError
        );
      }
    }

    throw error;
  }
}

// Delete a private cloud image permanently.
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
