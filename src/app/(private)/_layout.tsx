import { SQLiteProvider } from 'expo-sqlite';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/components/auth-provider';
import { ForegroundCleanup } from '@/components/foreground-cleanup';

import { initializeDatabase } from '@/database/database';
import { purgeExpiredDeletedItems } from '@/database/items';

export default function PrivateLayout() {
  const { user } = useAuth();

  // The root navigator will also protect this route.
  if (!user) {
    return null;
  }

  // Each account gets a separate local database.
  // The original folio.db remains untouched.
  const databaseName = `folio-user-${user.id}.db`;

  return (
    <SQLiteProvider
      key={user.id}
      databaseName={databaseName}
      onInit={async (db) => {
        await initializeDatabase(db);

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
      <AppTabs />
    </SQLiteProvider>
  );
}
