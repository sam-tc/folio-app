import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ForegroundCleanup } from '@/components/foreground-cleanup';

import { initializeDatabase } from '@/database/database';
import { purgeExpiredDeletedItems } from '@/database/items';

void SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider
      value={
        colorScheme === 'dark'
          ? DarkTheme
          : DefaultTheme
      }
    >
      <SQLiteProvider
        databaseName="folio.db"
        onInit={async (db) => {
          // Upgrade or repair the database first.
          await initializeDatabase(db);

          // Verify the real database's schema version.
          const version = await db.getFirstAsync<{
            user_version: number;
          }>('PRAGMA user_version;');

          // Verify the image cleanup table exists.
          const cleanupTable = await db.getFirstAsync<{
            name: string;
          }>(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table'
               AND name = 'pending_image_deletions'
             LIMIT 1`
          );

          console.log(
            'Folio schema:',
            version?.user_version,
            '| image cleanup table:',
            cleanupTable ? 'ready' : 'missing'
          );

          // Remove expired SQLite records and queue image files.
          const deletedCount =
            await purgeExpiredDeletedItems(db);

          console.log(
            'Folio automatic cleanup:',
            deletedCount,
            'expired items removed'
          );
        }}
      >
        <ForegroundCleanup />
        <AnimatedSplashOverlay />
        <AppTabs />
      </SQLiteProvider>
    </ThemeProvider>
  );
}
