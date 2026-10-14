import { useFolioColorScheme as useColorScheme } from '@/components/appearance-provider';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { useSQLiteContext } from 'expo-sqlite';

import { createItem } from '@/database/items';

type Props = {
  visible: boolean;
  itemType?: 'note' | 'link';
  onClose: () => void;
  onSaved: () => void;
};

type Palette = {
  background: string;
  surface: string;
  border: string;
  text: string;
  secondaryText: string;
  subtleText: string;
  accent: string;
  placeholder: string;
};

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F7F4ED',
    surface: '#FFFEFA',
    border: '#D8E0D5',
    text: '#222A22',
    secondaryText: '#526457',
    subtleText: '#728174',
    accent: '#315C46',
    placeholder: '#829184',
  },
  dark: {
    background: '#171B18',
    surface: '#252D27',
    border: '#45574B',
    text: '#F7F4EE',
    secondaryText: '#C3CBC1',
    subtleText: '#9BAB9D',
    accent: '#A9CFB1',
    placeholder: '#A0AEA2',
  },
};

export default function CreateNoteModal({
  visible,
  itemType = 'note',
  onClose,
  onSaved,
}: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = palettes[isDark ? 'dark' : 'light'];
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Cover the system status bar and home indicator without overlapping them.
  const safeTop = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0);
  const safeBottom = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const isLink = itemType === 'link';

  function resetForm() {
    setTitle('');
    setContent('');
    setTags('');
  }

  function handleClose() {
    if (saving) return;
    resetForm();
    onClose();
  }

  async function handleSave() {
    if (saving) return;

    if (!title.trim() || !content.trim()) {
      Alert.alert(
        'Missing information',
        isLink
          ? 'Please enter a title and website URL.'
          : 'Please enter a title and note content.'
      );
      return;
    }

    setSaving(true);
    try {
      // Database validation and URL normalization stay in createItem.
      await createItem(db, {
        type: itemType,
        title,
        content,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      resetForm();
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        isLink ? 'Could not save link' : 'Could not save note',
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
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
      onRequestClose={handleClose}
    >
      <View style={[styles.screen, { paddingTop: safeTop, paddingBottom: safeBottom }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerAction}
              onPress={handleClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Cancel creation"
            >
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>

            <Text style={styles.heading}>
              {isLink ? 'New link' : 'New note'}
            </Text>

            <Pressable
              style={[styles.headerAction, styles.headerActionRight]}
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save item"
            >
              <Text style={[styles.save, saving && styles.saving]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>ADD TO FOLIO</Text>
            <Text style={styles.title}>
              {isLink ? 'Save something good.' : 'Capture a thought.'}
            </Text>
            <Text style={styles.intro}>
              {isLink
                ? 'Keep a useful corner of the internet close.'
                : 'A little space for what you don’t want to forget.'}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={isLink ? 'Give your link a title' : 'Give your note a title'}
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                maxLength={150}
                accessibilityLabel={isLink ? 'Link title' : 'Note title'}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{isLink ? 'WEBSITE URL' : 'YOUR NOTE'}</Text>
              <TextInput
                style={[styles.input, !isLink && styles.textArea]}
                value={content}
                onChangeText={setContent}
                placeholder={
                  isLink ? 'https://example.com' : 'Write something worth keeping…'
                }
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                multiline={!isLink}
                textAlignVertical={isLink ? undefined : 'top'}
                keyboardType={isLink ? 'url' : 'default'}
                autoCapitalize={isLink ? 'none' : 'sentences'}
                autoCorrect={!isLink}
                accessibilityLabel={isLink ? 'Website URL' : 'Note content'}
              />
              {isLink && (
                <Text style={styles.hint}>
                  You can also enter a domain like github.com.
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>TAGS</Text>
              <TextInput
                style={styles.input}
                value={tags}
                onChangeText={setTags}
                placeholder="college, ideas, reading"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                autoCapitalize="none"
                accessibilityLabel="Item tags"
              />
              <Text style={styles.hint}>Separate multiple tags with commas.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      minHeight: 64,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerAction: {
      minWidth: 72,
      minHeight: 44,
      justifyContent: 'center',
    },
    headerActionRight: { alignItems: 'flex-end' },
    heading: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: -0.3,
    },
    cancel: { color: colors.secondaryText, fontSize: 15 },
    save: { color: colors.accent, fontSize: 15, fontWeight: '700' },
    saving: { opacity: 0.5 },
    form: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48 },
    eyebrow: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2.1,
      marginBottom: 10,
    },
    title: {
      color: colors.text,
      fontSize: 29,
      lineHeight: 36,
      fontWeight: '600',
      letterSpacing: -1.1,
      marginBottom: 8,
    },
    intro: {
      color: colors.secondaryText,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 10,
    },
    field: { marginTop: 22 },
    label: {
      color: colors.secondaryText,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.6,
      marginBottom: 10,
    },
    input: {
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
    },
    textArea: { minHeight: 175 },
    hint: {
      color: colors.subtleText,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
    },
  });
}
