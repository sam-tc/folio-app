import { View, StyleSheet } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

import {
  AppearanceProvider,
  useFolioColorScheme,
} from '@/components/appearance-provider';

import {
  AuthProvider,
  useAuth,
} from '@/components/auth-provider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <FolioApp />
      </AuthProvider>
    </AppearanceProvider>
  );
}

function FolioApp() {
  const colorScheme = useFolioColorScheme();
  const isDark = colorScheme === 'dark';

  const { session, loading } = useAuth();

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

  const backgroundColor = isDark
    ? '#171B18'
    : '#F7F4ED';

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View
        style={[
          styles.container,
          { backgroundColor },
        ]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor,
            },
          }}
        >
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(private)" />
          </Stack.Protected>

          <Stack.Protected guard={!session}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>

        {loading ? (
          <View
            style={[
              styles.loadingCover,
              { backgroundColor },
            ]}
            accessibilityLabel="Restoring Folio session"
          />
        ) : null}

        <AnimatedSplashOverlay />
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingCover: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
});
