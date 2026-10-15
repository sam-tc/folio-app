import {
  archiveCloudItem,
  createCloudItem,
  getCloudItemById,
  getCloudItems,
  permanentlyDeleteCloudItem,
  recoverCloudItem,
  trashCloudItem,
  unarchiveCloudItem,
  updateCloudItem,
} from '@/lib/cloud-items';

function assertTest(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export async function runCloudSmokeTest(): Promise<
  string[]
> {
  const results: string[] = [];

  // Track the exact temporary item created by this test.
  let testItemId: string | null = null;

  function passed(message: string) {
    results.push(message);
    console.log(`PASS: ${message}`);
  }

  try {
    // 1. CREATE
    const created = await createCloudItem({
      type: 'note',
      title: `Folio Cloud Test ${Date.now()}`,
      content: 'Temporary test note for cloud CRUD.',
      tags: ['cloud-test'],
    });

    testItemId = created.id;

    assertTest(
      created.type === 'note',
      'Cloud creation returned an unexpected item.'
    );

    passed('Create cloud note');

    // 2. READ
    const fetched = await getCloudItemById(created.id);

    assertTest(
      fetched !== null &&
        fetched.id === created.id,
      'Could not retrieve the created cloud note.'
    );

    const inbox = await getCloudItems('inbox');

    assertTest(
      inbox.some((item) => item.id === created.id),
      'Created note is missing from the cloud inbox.'
    );

    passed('Read cloud note');

    // 3. UPDATE
    const updated = await updateCloudItem(
      created.id,
      {
        title: 'Updated Folio Cloud Test',
        content: 'The cloud update succeeded.',
        tags: ['cloud-test', 'updated'],
      }
    );

    assertTest(
      updated.title === 'Updated Folio Cloud Test' &&
        updated.tags.includes('updated'),
      'Cloud note was not updated correctly.'
    );

    passed('Update cloud note');

    // 4. ARCHIVE
    const archived = await archiveCloudItem(
      created.id
    );

    assertTest(
      archived.is_archived,
      'Cloud note was not archived.'
    );

    const archive = await getCloudItems('archive');

    assertTest(
      archive.some((item) => item.id === created.id),
      'Cloud note is missing from Archive.'
    );

    passed('Archive cloud note');

    // 5. RESTORE FROM ARCHIVE
    const restored = await unarchiveCloudItem(
      created.id
    );

    assertTest(
      !restored.is_archived,
      'Cloud note was not restored from Archive.'
    );

    passed('Restore archived note');

    // 6. MOVE TO TRASH
    const trashed = await trashCloudItem(
      created.id
    );

    assertTest(
      trashed.deleted_at !== null,
      'Cloud note was not moved to Recently Deleted.'
    );

    const deletedItems = await getCloudItems(
      'deleted'
    );

    assertTest(
      deletedItems.some(
        (item) => item.id === created.id
      ),
      'Cloud note is missing from Recently Deleted.'
    );

    passed('Move cloud note to Recently Deleted');

    // 7. RECOVER
    const recovered = await recoverCloudItem(
      created.id
    );

    assertTest(
      recovered.deleted_at === null,
      'Cloud note was not recovered.'
    );

    passed('Recover cloud note');

    // 8. PERMANENT DELETE
    await permanentlyDeleteCloudItem(created.id);

    // Record is gone: do not attempt cleanup twice.
    testItemId = null;

    const missing = await getCloudItemById(
      created.id
    );

    assertTest(
      missing === null,
      'Permanently deleted note is still accessible.'
    );

    passed('Permanently delete cloud note');

    console.log(
      'FOLIO CLOUD CRUD TEST: ALL CHECKS PASSED'
    );

    return results;
  } finally {
    // If an earlier test fails, try to remove only
    // the specific temporary note we created.
    if (testItemId) {
      try {
        await permanentlyDeleteCloudItem(
          testItemId
        );

        console.log(
          'Temporary cloud test note cleaned up.'
        );
      } catch (error) {
        console.warn(
          'Could not clean up temporary cloud test note:',
          error
        );
      }
    }
  }
}
