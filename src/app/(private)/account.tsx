import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { useFolioColorScheme } from '@/components/appearance-provider';

type Palette = {
  background: string;
  surface: string;
  text: string;
  secondary: string;
  accent: string;
  border: string;
  error: string;
};

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F7F4ED',
    surface: '#FFFEFA',
    text: '#222A22',
    secondary: '#667469',
    accent: '#315C46',
    border: '#D8E0D5',
    error: '#A43E38',
  },
  dark: {
    background: '#171B18',
    surface: '#252D27',
    text: '#F7F4EE',
    secondary: '#C3CBC1',
    accent: '#A9CFB1',
    border: '#45574B',
    error: '#FFAAA3',
  },
};

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const isDark = useFolioColorScheme() === 'dark';
  const colors = palettes[isDark ? 'dark' : 'light'];

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const [signingOut, setSigningOut] = useState(false);

  async function performSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      const { error } = await signOut();

      if (error) {
        Alert.alert(
          'Could not sign out',
          error.message
        );
      }
    } catch (error) {
      Alert.alert(
        'Could not sign out',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setSigningOut(false);
    }
  }

  function confirmSignOut() {
    if (signingOut) return;

    Alert.alert(
      'Sign out of Folio?',
      'Your saved items will not be deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void performSignOut();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24) + 30,
            paddingBottom: 60,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          YOUR SPACE
        </Text>

        <Text style={styles.heading}>
          Account
        </Text>

        <Text style={styles.subtitle}>
          Manage your Folio account.
        </Text>

        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase() ?? 'F'}
            </Text>
          </View>

          <View style={styles.accountDetails}>
            <Text style={styles.accountLabel}>
              SIGNED IN AS
            </Text>

            <Text
              style={styles.email}
              selectable
              numberOfLines={2}
            >
              {user?.email ?? 'Unknown account'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Session
          </Text>

          <Text style={styles.sectionDescription}>
            Sign out when you're finished using this
            device. You can sign in again with the same
            account.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.pressed,
              signingOut && styles.disabled,
            ]}
            onPress={confirmSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out of Folio"
          >
            {signingOut ? (
              <ActivityIndicator
                size="small"
                color={colors.error}
              />
            ) : (
              <Text style={styles.signOutText}>
                Sign out
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your personal collection.
          </Text>

          <Text style={styles.footerVersion}>
            Folio · Version 1.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },

    content: {
      flexGrow: 1,
      paddingHorizontal: 24,
    },

    eyebrow: {
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '700',
      marginBottom: 12,
    },

    heading: {
      color: c.text,
      fontSize: 34,
      fontWeight: '600',
      letterSpacing: -1.2,
    },

    subtitle: {
      color: c.secondary,
      fontSize: 15,
      lineHeight: 23,
      marginTop: 10,
      marginBottom: 30,
    },

    accountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      padding: 18,
      gap: 15,
    },

    avatar: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },

    avatarText: {
      color: c.background,
      fontSize: 23,
      fontWeight: '600',
    },

    accountDetails: {
      flex: 1,
      gap: 6,
    },

    accountLabel: {
      color: c.secondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.3,
    },

    email: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 22,
    },

    section: {
      marginTop: 44,
    },

    sectionTitle: {
      color: c.text,
      fontSize: 19,
      fontWeight: '600',
      marginBottom: 10,
    },

    sectionDescription: {
      color: c.secondary,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 20,
    },

    signOutButton: {
      minHeight: 54,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    signOutText: {
      color: c.error,
      fontSize: 15,
      fontWeight: '700',
    },

    pressed: {
      opacity: 0.65,
    },

    disabled: {
      opacity: 0.5,
    },

    footer: {
      marginTop: 70,
      alignItems: 'center',
      gap: 7,
    },

    footerText: {
      color: c.secondary,
      fontSize: 13,
    },

    footerVersion: {
      color: c.secondary,
      fontSize: 11,
    },
  });
}
