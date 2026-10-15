import {
  deletePrivateImage,
  getPrivateImageUrl,
  uploadPrivateImage,
} from '@/lib/cloud-images';

export async function runCloudImageSmokeTest(
  localUri: string
): Promise<void> {
  let uploadedPath: string | null = null;

  try {
    console.log('FOLIO IMAGE CLOUD TEST: STARTING');

    // Test 1: Upload a photo from the device.
    uploadedPath = await uploadPrivateImage(localUri);

    if (!uploadedPath) {
      throw new Error('Upload returned no image path.');
    }

    console.log('PASS: Upload private cloud image');

    // Test 2: Obtain a temporary access URL.
    const signedUrl = await getPrivateImageUrl(
      uploadedPath
    );

    if (!signedUrl) {
      throw new Error('Signed image URL is missing.');
    }

    console.log('PASS: Generate private image URL');

    // Test 3: Retrieve the actual image bytes.
    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error(
        `Cloud image download failed: ${response.status}`
      );
    }

    const imageBytes = await response.arrayBuffer();

    if (imageBytes.byteLength === 0) {
      throw new Error('Downloaded image was empty.');
    }

    console.log('PASS: Download private cloud image');

    // Test 4: Remove only the image created by this test.
    await deletePrivateImage(uploadedPath);
    uploadedPath = null;

    console.log('PASS: Delete temporary cloud image');

    console.log(
      'FOLIO IMAGE CLOUD TEST: ALL CHECKS PASSED'
    );
  } finally {
    // If an earlier test fails, attempt to clean up
    // the uploaded test image.
    if (uploadedPath) {
      try {
        await deletePrivateImage(uploadedPath);

        console.log(
          'Temporary cloud test image cleaned up.'
        );
      } catch (cleanupError) {
        console.warn(
          'Temporary image cleanup failed:',
          cleanupError
        );
      }
    }
  }
}
