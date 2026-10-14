import { Directory, File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

// All saved images belong in Folio's private documents folder.
const imageDirectory = new Directory(
  Paths.document,
  'folio-images'
);

// Supported image extensions.
const supportedExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.gif',
  '.avif',
]);

const mimeExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

function getImageExtension(asset: ImagePickerAsset): string {
  const source = new File(asset.uri);

  const filenameExtension =
    asset.fileName?.match(/\.[^.]+$/)?.[0]?.toLowerCase();

  if (
    filenameExtension &&
    supportedExtensions.has(filenameExtension)
  ) {
    return filenameExtension;
  }

  const mimeExtension = asset.mimeType
    ? mimeExtensions[asset.mimeType.toLowerCase()]
    : undefined;

  if (mimeExtension) {
    return mimeExtension;
  }

  const sourceExtension = source.extension.toLowerCase();

  if (supportedExtensions.has(sourceExtension)) {
    return sourceExtension;
  }

  throw new Error('Unsupported image format.');
}

// Copy a selected image into persistent app storage.
export async function savePickedImage(
  asset: ImagePickerAsset
): Promise<string> {
  if (!asset.uri) {
    throw new Error('No image was selected.');
  }

  // Create the folder if it doesn't already exist.
  imageDirectory.create({
    idempotent: true,
    intermediates: true,
  });

  const extension = getImageExtension(asset);

  // Give each saved image a unique filename.
  const filename =
    `folio-${Date.now()}-` +
    `${Math.random().toString(36).slice(2, 12)}` +
    extension;

  const source = new File(asset.uri);
  const destination = new File(imageDirectory, filename);

  try {
    await source.copy(destination);

    if (!destination.exists || destination.size === 0) {
      throw new Error('Image could not be copied.');
    }

    // Return the saved location for SQLite.
    return destination.uri;
  } catch (error) {
    // Remove any incomplete copy if saving fails.
    if (destination.exists) {
      try {
        destination.delete();
      } catch (cleanupError) {
        console.warn(
          'Could not remove incomplete image:',
          cleanupError
        );
      }
    }

    throw error;
  }
}

export function deleteStoredImage(uri: string): void {
  const directoryUri = imageDirectory.uri.endsWith('/')
    ? imageDirectory.uri
    : `${imageDirectory.uri}/`;

  // Never delete files outside Folio's image folder.
  if (!uri.startsWith(directoryUri)) {
    throw new Error('This file is outside Folio image storage.');
  }

  const file = new File(uri);

  if (file.exists) {
    file.delete();
  }
}
