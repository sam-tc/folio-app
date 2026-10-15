import { useState } from 'react';
import { Platform } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/components/auth-provider';
import { ForegroundCleanup } from '@/components/foreground-cleanup';
import IncomingShareModal from '@/components/incoming-share-modal';
import ReminderNotificationHandler from '@/components/reminder-notification-handler';
import { installCloudDeletionTracking } from '@/database/cloud-deletion-tracking';
import { initializeDatabase } from '@/database/database';
import { purgeExpiredDeletedItems } from '@/database/items';

export default function PrivateLayout() {
  const { user } = useAuth();

  const [libraryRevision, setLibraryRevision] =
    useState(0);

  if (!user) {
    return null;
  }

  // Each account has its own local database.
  // The original folio.db remains untouched.
  const databaseName = `folio-user-${user.id}.db`;

  function handleLibraryChanged() {
    // Reload the Library after an item is saved or edited.
    setLibraryRevision((current) => current + 1);
  }

  return (
    <SQLiteProvider
      key={user.id}
      databaseName={databaseName}
      onInit={async (db) => {
        await initializeDatabase(db);

        // Track permanent deletions before cleanup runs.
        await installCloudDeletionTracking(db);

        const deletedCount =
          await purgeExpiredDeletedItems(db);

        console.log(
          'Folio account database initialized.',
          '| expired items removed:',
          deletedCount
        );
      }}
    >
      <ForegroundCleanup />

      <AppTabs
        key={`${user.id}:${libraryRevision}`}
      />

      <ReminderNotificationHandler
        onSaved={handleLibraryChanged}
      />

      {Platform.OS === 'android' ? (
        <IncomingShareModal
          onSaved={handleLibraryChanged}
        />
      ) : null}
    </SQLiteProvider>
  );
}
