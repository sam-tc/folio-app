import { useState } from 'react';
import Constants from 'expo-constants';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  useAppearancePreference,
  useFolioColorScheme,
  type AppearancePreference,
} from '@/components/appearance-provider';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const APPEARANCES: {
  value: AppearancePreference;
  title: string;
  description: string;
  symbol: string;
}[] = [
  {
    value: 'system',
    title: 'System',
    description: 'Match your device settings',
    symbol: '◐',
  },
  {
    value: 'light',
    title: 'Light',
    description: 'Warm paper and forest green',
    symbol: '☼',
  },
  {
    value: 'dark',
    title: 'Dark',
    description: 'A quieter, evening palette',
    symbol: '☾',
  },
];

export default function SettingsModal({
  visible,
  onClose,
}: Props) {
  const dark = useFolioColorScheme() === 'dark';
  const { preference, setPreference } =
    useAppearancePreference();

  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  // Full-screen modals can sometimes report zero
  // safe-area insets in Expo Go.
  //
  // Use the measured insets where available.
  // On iOS, include a fallback to keep the header
  // below the clock and camera cutout.
  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? 0,
    Platform.OS === 'ios' ? 56 : 0
  );

  const bottomInset = Math.max(
    insets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0,
    Platform.OS === 'ios' ? 24 : 0
  );

  const palette = {
    background: dark ? '#171B18' : '#F7F4ED',
    surface: dark ? '#252F28' : '#FFFEFB',
    text: dark ? '#F7F4EE' : '#223329',
    secondary: dark ? '#B5C1B6' : '#627266',
    border: dark ? '#3D4D40' : '#DFE6DB',
    accent: dark ? '#9FBBA3' : '#315C46',
    selected: dark ? '#324A39' : '#E8F0E6',
  };

  async function selectAppearance(
    value: AppearancePreference
  ) {
    if (saving || value === preference) return;

    setSaving(true);

    try {
      await setPreference(value);
    } catch (error) {
      Alert.alert(
        'Could not save appearance',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.screen,
          {
            backgroundColor: palette.background,
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              borderBottomColor: palette.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Settings"
            onPress={onClose}
            style={({ pressed }) => [
              styles.backButton,
              {
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.backArrow,
                { color: palette.accent },
              ]}
            >
              ‹
            </Text>

            <Text
              style={[
                styles.backText,
                { color: palette.accent },
              ]}
            >
              Done
            </Text>
          </Pressable>

          <Text
            style={[
              styles.headerTitle,
              { color: palette.text },
            ]}
          >
            Settings
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              styles.eyebrow,
              { color: palette.accent },
            ]}
          >
            MAKE IT YOURS
          </Text>

          <Text
            style={[
              styles.title,
              { color: palette.text },
            ]}
          >
            A space that feels like yours.
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: palette.secondary },
            ]}
          >
            Just the essentials. Nothing extra.
          </Text>

          <Text
            style={[
              styles.sectionLabel,
              { color: palette.secondary },
            ]}
          >
            APPEARANCE
          </Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            {APPEARANCES.map((option, index) => {
              const selected =
                preference === option.value;

              return (
                <Pressable
                  key={option.value}
                  disabled={saving}
                  onPress={() =>
                    void selectAppearance(option.value)
                  }
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected,
                    disabled: saving,
                  }}
                  accessibilityLabel={`${option.title} appearance`}
                  accessibilityHint={option.description}
                  style={({ pressed }) => [
                    styles.option,
                    index > 0 && {
                      borderTopWidth:
                        StyleSheet.hairlineWidth,
                      borderTopColor: palette.border,
                    },
                    selected && {
                      backgroundColor: palette.selected,
                    },
                    pressed && {
                      opacity: 0.72,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.symbol,
                      { color: palette.accent },
                    ]}
                  >
                    {option.symbol}
                  </Text>

                  <View style={styles.optionText}>
                    <Text
                      style={[
                        styles.optionTitle,
                        { color: palette.text },
                      ]}
                    >
                      {option.title}
                    </Text>

                    <Text
                      style={[
                        styles.optionDescription,
                        { color: palette.secondary },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>

                  {selected ? (
                    <Text
                      style={[
                        styles.check,
                        { color: palette.accent },
                      ]}
                    >
                      ✓
                    </Text>
                  ) : (
                    <View
                      style={[
                        styles.unselected,
                        {
                          borderColor: palette.border,
                        },
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {saving ? (
            <ActivityIndicator
              color={palette.accent}
              style={styles.saving}
            />
          ) : null}

          <Text
            style={[
              styles.sectionLabel,
              { color: palette.secondary },
            ]}
          >
            ABOUT
          </Text>

          <View
            style={[
              styles.aboutCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.aboutRow}>
              <Text
                style={[
                  styles.aboutLabel,
                  { color: palette.text },
                ]}
              >
                Folio
              </Text>

              <Text
                style={[
                  styles.aboutValue,
                  { color: palette.secondary },
                ]}
              >
                Your personal library
              </Text>
            </View>

            <View
              style={[
                styles.aboutDivider,
                {
                  backgroundColor: palette.border,
                },
              ]}
            />

            <View style={styles.aboutRow}>
              <Text
                style={[
                  styles.aboutLabel,
                  { color: palette.text },
                ]}
              >
                Version
              </Text>

              <Text
                style={[
                  styles.aboutValue,
                  { color: palette.secondary },
                ]}
              >
                {Constants.expoConfig?.version ??
                  '1.0.0'}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.footer,
              { color: palette.secondary },
            ]}
          >
            A little space for everything worth keeping.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 76,
    minHeight: 48,
  },

  backArrow: {
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 35,
    marginRight: 5,
  },

  backText: {
    fontSize: 14,
    fontWeight: '600',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },

  headerSpacer: {
    width: 76,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 35,
    paddingBottom: 55,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.1,
  },

  title: {
    fontFamily: Platform.select({
      ios: 'Georgia',
      default: 'serif',
    }),
    fontSize: 29,
    lineHeight: 37,
    letterSpacing: -0.7,
    marginTop: 14,
    maxWidth: 310,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginTop: 34,
    marginBottom: 11,
  },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },

  option: {
    minHeight: 77,
    paddingVertical: 15,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  symbol: {
    width: 26,
    fontSize: 24,
    textAlign: 'center',
    fontWeight: '300',
  },

  optionText: {
    flex: 1,
    gap: 4,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },

  optionDescription: {
    fontSize: 12,
    lineHeight: 17,
  },

  check: {
    fontSize: 19,
    fontWeight: '700',
    width: 22,
    textAlign: 'center',
  },

  unselected: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    marginRight: 1,
  },

  saving: {
    marginTop: 10,
  },

  aboutCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 17,
  },

  aboutRow: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  aboutLabel: {
    fontSize: 14,
    fontWeight: '500',
  },

  aboutValue: {
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'right',
  },

  aboutDivider: {
    height: StyleSheet.hairlineWidth,
  },

  footer: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 46,
  },
});
