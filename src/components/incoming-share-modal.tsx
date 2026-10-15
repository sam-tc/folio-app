import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  clearSharedPayloads,
  getSharedPayloads,
  type SharePayload,
} from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useFolioColorScheme } from '@/components/appearance-provider';
import { createItem } from '@/database/items';
import {
  prepareIncomingShare,
} from '@/lib/incoming-share';

type Props = {
  onSaved: () => void;
};

type SaveType = 'note' | 'link';

type Palette = {
  background: string;
  surface: string;
  border: string;
  text: string;
  secondary: string;
  accent: string;
  placeholder: string;
  selectedText: string;
};

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F7F4ED',
    surface: '#FFFEFA',
    border: '#D8E0D5',
    text: '#222A22',
    secondary: '#526457',
    accent: '#315C46',
    placeholder: '#829184',
    selectedText: '#FFFFFF',
  },
  dark: {
    background: '#171B18',
    surface: '#252D27',
    border: '#45574B',
    text: '#F7F4EE',
    secondary: '#C3CBC1',
    accent: '#A9CFB1',
    placeholder: '#A0AEA2',
    selectedText: '#171B18',
  },
};

export default function IncomingShareModal({
  onSaved,
}: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const isDark =
    useFolioColorScheme() === 'dark';

  const colors =
    palettes[isDark ? 'dark' : 'light'];

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  /*
   * Keep the incoming payload in Folio's own
   * React state.
   *
   * Expo's clearSharedPayloads() clears the
   * native value, but does not immediately
   * update useIncomingShare()'s React state.
   *
   * Managing this state explicitly makes
   * Cancel close the modal immediately.
   */
  const [sharedPayloads, setSharedPayloads] =
    useState<SharePayload[]>(
      () => getSharedPayloads()
    );

  const [itemType, setItemType] =
    useState<SaveType>('note');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  /*
   * Read the latest native share.
   *
   * Avoid updating React state when the share
   * is unchanged. This also prevents a return
   * to Folio from resetting an edited form.
   */
  const refreshIncomingShare = useCallback(() => {
    try {
      const latest = getSharedPayloads();

      setSharedPayloads((current) => {
        const currentSignature =
          JSON.stringify(current);

        const latestSignature =
          JSON.stringify(latest);

        return currentSignature === latestSignature
          ? current
          : latest;
      });
    } catch (error) {
      console.warn(
        'FOLIO INCOMING SHARE: Could not refresh',
        error
      );
    }
  }, []);

  /*
   * Android can deliver a new share when:
   *
   * - Folio launches for the first time.
   * - Folio returns from Chrome.
   * - A new incoming URL is received.
   *
   * Read from native storage in all three cases.
   */
  useEffect(() => {
    refreshIncomingShare();

    const appStateSubscription =
      AppState.addEventListener(
        'change',
        (nextState) => {
          if (nextState === 'active') {
            refreshIncomingShare();
          }
        }
      );

    const linkSubscription =
      Linking.addEventListener(
        'url',
        () => {
          refreshIncomingShare();
        }
      );

    return () => {
      appStateSubscription.remove();
      linkSubscription.remove();
    };
  }, [refreshIncomingShare]);

  const prepared = useMemo(
    () => prepareIncomingShare(sharedPayloads),
    [sharedPayloads]
  );

  /*
   * Only prefill the form when a new share
   * arrives, not when the user edits a field.
   */
  useEffect(() => {
    if (prepared.status === 'ready') {
      setItemType(prepared.type);
      setTitle(prepared.title);
      setContent(prepared.content);
      setTags('');
    } else {
      setItemType('note');
      setTitle('');
      setContent('');
      setTags('');
    }
  }, [prepared]);

  const visible = sharedPayloads.length > 0;
  const isReady = prepared.status === 'ready';

  const safeTop = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? 0,
    Platform.OS === 'ios' ? 56 : 0
  );

  const safeBottom = Math.max(
    insets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0,
    Platform.OS === 'ios' ? 24 : 0
  );

  /*
   * Clear BOTH the native share and the
   * local state that controls the modal.
   *
   * Setting [] makes the modal disappear
   * immediately instead of waiting for
   * another app-state event.
   */
  function dismissShare() {
    clearSharedPayloads();
    setSharedPayloads([]);
  }

  function handleCancel() {
    if (saving) {
      return;
    }

    console.log(
      'FOLIO INCOMING SHARE: CANCELLED'
    );

    dismissShare();
  }

  async function handleSave() {
    if (saving || !isReady) {
      return;
    }

    if (!title.trim() || !content.trim()) {
      Alert.alert(
        'Missing information',
        'Please enter a title and content before saving.'
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * Save locally before clearing the share.
       *
       * If SQLite rejects an invalid URL or
       * fails for another reason, the content
       * stays in the review form.
       */
      await createItem(db, {
        type: itemType,
        title: title.trim(),
        content: content.trim(),
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      console.log(
        'FOLIO INCOMING SHARE: SAVED LOCALLY',
        itemType
      );

      dismissShare();

      // Refresh the existing Library.
      onSaved();

      Alert.alert(
        'Saved to Folio',
        itemType === 'link'
          ? 'Your link has been added to your library.'
          : 'Your note has been added to your library.'
      );
    } catch (error) {
      Alert.alert(
        'Could not save shared content',
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
      onRequestClose={handleCancel}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: safeTop,
            paddingBottom: safeBottom,
          },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <View style={styles.header}>
            <Pressable
              onPress={handleCancel}
              disabled={saving}
              style={styles.headerAction}
              accessibilityRole="button"
              accessibilityLabel="Cancel incoming share"
            >
              <Text style={styles.cancelText}>
                Cancel
              </Text>
            </Pressable>

            <Text style={styles.headerTitle}>
              Save to Folio
            </Text>

            <Pressable
              onPress={() => void handleSave()}
              disabled={saving || !isReady}
              style={[
                styles.headerAction,
                styles.rightAction,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save shared content"
            >
              <Text
                style={[
                  styles.saveText,
                  (!isReady || saving) &&
                    styles.disabled,
                ]}
              >
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>
              SHARED WITH FOLIO
            </Text>

            <Text style={styles.heading}>
              Keep something good.
            </Text>

            <Text style={styles.intro}>
              Review what was shared before adding
              it to your personal library.
            </Text>

            {isReady ? (
              <>
                <Text style={styles.fieldLabel}>
                  SAVE AS
                </Text>

                <View style={styles.typeRow}>
                  {(
                    ['note', 'link'] as const
                  ).map((type) => {
                    const selected =
                      itemType === type;

                    return (
                      <Pressable
                        key={type}
                        onPress={() =>
                          setItemType(type)
                        }
                        disabled={saving}
                        style={[
                          styles.typeButton,
                          selected
                            ? styles.selectedType
                            : styles.unselectedType,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                        }}
                      >
                        <Text
                          style={[
                            styles.typeText,
                            {
                              color: selected
                                ? colors.selectedText
                                : colors.text,
                            },
                          ]}
                        >
                          {type === 'note'
                            ? 'Note'
                            : 'Link'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    TITLE
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    editable={!saving}
                    placeholder="Give it a title"
                    placeholderTextColor={
                      colors.placeholder
                    }
                    selectionColor={colors.accent}
                    maxLength={150}
                    accessibilityLabel="Shared item title"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {itemType === 'link'
                      ? 'WEBSITE URL'
                      : 'YOUR NOTE'}
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      itemType === 'note' &&
                        styles.textArea,
                    ]}
                    value={content}
                    onChangeText={setContent}
                    editable={!saving}
                    multiline={itemType === 'note'}
                    textAlignVertical={
                      itemType === 'note'
                        ? 'top'
                        : undefined
                    }
                    keyboardType={
                      itemType === 'link'
                        ? 'url'
                        : 'default'
                    }
                    autoCapitalize={
                      itemType === 'link'
                        ? 'none'
                        : 'sentences'
                    }
                    autoCorrect={
                      itemType !== 'link'
                    }
                    placeholder={
                      itemType === 'link'
                        ? 'https://example.com'
                        : 'Write something worth keeping…'
                    }
                    placeholderTextColor={
                      colors.placeholder
                    }
                    selectionColor={colors.accent}
                    accessibilityLabel={
                      itemType === 'link'
                        ? 'Shared website URL'
                        : 'Shared note content'
                    }
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    TAGS
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={tags}
                    onChangeText={setTags}
                    editable={!saving}
                    placeholder="reading, ideas, college"
                    placeholderTextColor={
                      colors.placeholder
                    }
                    selectionColor={colors.accent}
                    autoCapitalize="none"
                    accessibilityLabel="Shared item tags"
                  />

                  <Text style={styles.hint}>
                    Separate tags with commas.
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.messageBox}>
                <Text style={styles.messageTitle}>
                  {prepared.status === 'empty'
                    ? 'Nothing received'
                    : 'Unsupported content'}
                </Text>

                <Text style={styles.messageText}>
                  {prepared.message}
                </Text>

                <Pressable
                  style={styles.dismissButton}
                  onPress={handleCancel}
                  accessibilityRole="button"
                >
                  <Text style={styles.dismissText}>
                    Return to Folio
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    fill: {
      flex: 1,
    },

    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      height: 64,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },

    headerAction: {
      minWidth: 70,
      minHeight: 44,
      justifyContent: 'center',
    },

    rightAction: {
      alignItems: 'flex-end',
    },

    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },

    cancelText: {
      color: colors.secondary,
      fontSize: 15,
    },

    saveText: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: '700',
    },

    disabled: {
      opacity: 0.4,
    },

    form: {
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 48,
    },

    eyebrow: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.8,
      marginBottom: 11,
    },

    heading: {
      color: colors.text,
      fontSize: 29,
      lineHeight: 36,
      fontWeight: '600',
      letterSpacing: -1,
      marginBottom: 8,
    },

    intro: {
      color: colors.secondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 28,
    },

    field: {
      marginTop: 24,
    },

    fieldLabel: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: 10,
    },

    typeRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 5,
    },

    typeButton: {
      minHeight: 46,
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    selectedType: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },

    unselectedType: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },

    typeText: {
      fontSize: 14,
      fontWeight: '600',
    },

    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      borderRadius: 13,
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
    },

    textArea: {
      minHeight: 150,
    },

    hint: {
      color: colors.secondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
    },

    messageBox: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 20,
      gap: 12,
    },

    messageTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },

    messageText: {
      color: colors.secondary,
      fontSize: 14,
      lineHeight: 21,
    },

    dismissButton: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },

    dismissText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
