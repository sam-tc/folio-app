import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFolioColorScheme } from '@/components/appearance-provider';
import { useAuth } from '@/components/auth-provider';

type AuthMode = 'signin' | 'signup';

type Palette = {
  background: string;
  surface: string;
  text: string;
  secondary: string;
  accent: string;
  buttonText: string;
  border: string;
  placeholder: string;
  notice: string;
  error: string;
};

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F7F4ED',
    surface: '#FFFEFA',
    text: '#222A22',
    secondary: '#667469',
    accent: '#315C46',
    buttonText: '#FFFFFF',
    border: '#D8E0D5',
    placeholder: '#8C988D',
    notice: '#E6EEE4',
    error: '#A43E38',
  },
  dark: {
    background: '#171B18',
    surface: '#252D27',
    text: '#F7F4EE',
    secondary: '#C3CBC1',
    accent: '#A9CFB1',
    buttonText: '#17251B',
    border: '#45574B',
    placeholder: '#9EAEA0',
    notice: '#2D4032',
    error: '#FFAAA3',
  },
};

function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('too many emails')
  ) {
    return (
      'Too many requests have been made. ' +
      'Please wait a while before trying again.'
    );
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  if (normalized.includes('email not confirmed')) {
    return (
      'Please verify your email address before signing in.'
    );
  }

  return message;
}

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const isDark = useFolioColorScheme() === 'dark';
  const colors = palettes[isDark ? 'dark' : 'light'];

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isSignUp = mode === 'signup';

  function changeMode(nextMode: AuthMode) {
    if (busy) return;

    setMode(nextMode);
    setPassword('');
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function handleSubmit() {
    if (busy) return;

    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        'Your password must contain at least 6 characters.'
      );
      return;
    }

    setBusy(true);

    try {
      if (isSignUp) {
        const result = await signUp(
          cleanEmail,
          password
        );

        if (result.error) {
          setErrorMessage(
            friendlyAuthError(result.error.message)
          );
          return;
        }

        // Return to Sign In after Supabase accepts
        // the registration request.
        setMode('signin');
        setEmail(cleanEmail);
        setPassword('');

        if (result.needsEmailConfirmation) {
          // Supabase may return a success-like result
          // for an existing registered email.
          setSuccessMessage(
            'If your email is eligible for registration, ' +
            'you will receive a confirmation message. ' +
            'Verify your email before signing in. ' +
            'Already registered? Sign in below.'
          );
        } else {
          setSuccessMessage(
            'Your registration request was accepted. ' +
            'You can sign in below.'
          );
        }
      } else {
        const result = await signIn(
          cleanEmail,
          password
        );

        if (result.error) {
          setErrorMessage(
            friendlyAuthError(result.error.message)
          );
          return;
        }

        // AuthProvider will update the session and
        // protected navigation will display Folio.
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';

      setErrorMessage(friendlyAuthError(message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios' ? 'padding' : undefined
      }
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 30) + 32,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.brand}>
            <Text style={styles.brandName}>
              folio.
            </Text>

            <Text style={styles.brandCaption}>
              YOUR PERSONAL COLLECTION
            </Text>
          </View>

          <View style={styles.intro}>
            <Text style={styles.heading}>
              {isSignUp
                ? 'A place for everything.'
                : 'Welcome back.'}
            </Text>

            <Text style={styles.subtitle}>
              {isSignUp
                ? 'Create an account to keep your notes, links and images in your own private space.'
                : 'Sign in to return to your saved ideas, discoveries and memories.'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>
                EMAIL ADDRESS
              </Text>

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardAppearance={
                  isDark ? 'dark' : 'light'
                }
                editable={!busy}
                accessibilityLabel="Email address"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                PASSWORD
              </Text>

              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={
                  isSignUp
                    ? 'At least 6 characters'
                    : 'Enter your password'
                }
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={
                  isSignUp
                    ? 'new-password'
                    : 'current-password'
                }
                textContentType={
                  isSignUp
                    ? 'newPassword'
                    : 'password'
                }
                keyboardAppearance={
                  isDark ? 'dark' : 'light'
                }
                editable={!busy}
                accessibilityLabel="Password"
                onSubmitEditing={() => void handleSubmit()}
              />
            </View>

            {errorMessage ? (
              <View style={styles.messageBox}>
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  {successMessage}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !busy && styles.pressed,
                busy && styles.disabled,
              ]}
              onPress={() => void handleSubmit()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={
                isSignUp
                  ? 'Create account'
                  : 'Sign in'
              }
            >
              <Text style={styles.primaryButtonText}>
                {busy
                  ? 'Please wait…'
                  : isSignUp
                    ? 'Create account'
                    : 'Sign in'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchDescription}>
              {isSignUp
                ? 'Already have an account?'
                : 'New to Folio?'}
            </Text>

            <Pressable
              onPress={() =>
                changeMode(
                  isSignUp ? 'signin' : 'signup'
                )
              }
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.switchAction}>
                {isSignUp
                  ? 'Sign in'
                  : 'Create an account'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLine} />

            <Text style={styles.footerText}>
              A little space for the things worth keeping.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 26,
      justifyContent: 'center',
    },

    content: {
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },

    brand: {
      marginBottom: 64,
      alignItems: 'center',
    },

    brandName: {
      fontSize: 42,
      letterSpacing: -2.5,
      fontWeight: '700',
      color: colors.accent,
    },

    brandCaption: {
      color: colors.secondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2.4,
      marginTop: 10,
    },

    intro: {
      marginBottom: 35,
    },

    heading: {
      color: colors.text,
      fontSize: 31,
      lineHeight: 39,
      fontWeight: '600',
      letterSpacing: -1,
      marginBottom: 12,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 15,
      lineHeight: 24,
    },

    form: {
      gap: 20,
    },

    field: {
      gap: 10,
    },

    label: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
    },

    input: {
      minHeight: 56,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: 17,
      fontSize: 16,
    },

    primaryButton: {
      minHeight: 56,
      backgroundColor: colors.accent,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },

    primaryButtonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: '700',
    },

    pressed: {
      opacity: 0.8,
    },

    disabled: {
      opacity: 0.55,
    },

    messageBox: {
      padding: 13,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.error,
    },

    errorText: {
      color: colors.error,
      fontSize: 13,
      lineHeight: 20,
    },

    noticeBox: {
      backgroundColor: colors.notice,
      borderRadius: 10,
      padding: 14,
    },

    noticeText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
    },

    switchRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 5,
      rowGap: 6,
      marginTop: 32,
    },

    switchDescription: {
      color: colors.secondary,
      fontSize: 14,
    },

    switchAction: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '700',
    },

    footer: {
      alignItems: 'center',
      marginTop: 78,
      gap: 17,
    },

    footerLine: {
      height: 1,
      width: 40,
      backgroundColor: colors.border,
    },

    footerText: {
      color: colors.secondary,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
