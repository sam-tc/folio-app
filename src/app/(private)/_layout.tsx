import { useState } from 'react';
import { Platform } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/components/auth-provider';
import { ForegroundCleanup } from '@/components/foreground-cleanup';
import IncomingShareModal from '@/components/incoming-share-modal';

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

  // Keep each account's local items separate.
  // The original folio.db remains untouched.
  const databaseName = `folio-user-${user.id}.db`;

  function handleIncomingShareSaved() {
    /*
     * The shared item is already saved in SQLite.
     *
     * Remount the tabs so the Home Library loads
     * its updated local records immediately.
     *
     * This occurs only after a successful share save,
     * not during ordinary Library navigation.
     */
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

      {Platform.OS === 'android' ? (
        <IncomingShareModal
          onSaved={handleIncomingShareSaved}
        />
      ) : null}
    </SQLiteProvider>
  );
}
