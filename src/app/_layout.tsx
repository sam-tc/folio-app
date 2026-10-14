import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AppearanceProvider } from '@/components/appearance-provider';
import { ForegroundCleanup } from '@/components/foreground-cleanup';

import { initializeDatabase } from '@/database/database';
import { purgeExpiredDeletedItems } from '@/database/items';

void SplashScreen.preventAutoHideAsync();

// Keep Folio's preference available above the whole navigation tree.
export default function RootLayout() {
  return (
    <AppearanceProvider>
      <FolioApp />
    </AppearanceProvider>
  );
}

function FolioApp() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: '#171B18',
          card: '#171B18',
          text: '#F7F4EE',
          border: '#3D4D40',
          primary: '#9FBBA3',
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: '#F7F4ED',
          card: '#F7F4ED',
          text: '#222A22',
          border: '#DFE6DB',
          primary: '#315C46',
        },
      };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SQLiteProvider
        databaseName="folio.db"
        onInit={async (db) => {
          await initializeDatabase(db);

          const version = await db.getFirstAsync<{ user_version: number }>(
            'PRAGMA user_version;'
          );

          const cleanupTable = await db.getFirstAsync<{ name: string }>(
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

          const deletedCount = await purgeExpiredDeletedItems(db);
          console.log('Folio automatic cleanup:', deletedCount, 'expired items removed');
        }}
      >
        <ForegroundCleanup />
        <AnimatedSplashOverlay />
        <AppTabs />
      </SQLiteProvider>
    </ThemeProvider>
  );
}
