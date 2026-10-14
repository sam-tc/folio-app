import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { initializeDatabase } from '@/database/database';
import { purgeExpiredDeletedItems } from '@/database/items';
import { ForegroundCleanup } from '@/components/foreground-cleanup';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider
        databaseName="folio.db"
        onInit={async (db) => {
          // First, make sure the database is up to date.
          await initializeDatabase(db);

          // Then, remove items deleted 30 or more days ago.
          const deletedCount = await purgeExpiredDeletedItems(db);

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
