import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import type { SavedItem } from '@/database/items';
import { updateImageMetadata } from '@/database/images';

type Props = {
  image: SavedItem | null;
  onClose: () => void;
  onSaved: () => void;
};

type Palette = {
  background: string;
  surface: string;
  preview: string;
  border: string;
  text: string;
  secondaryText: string;
  subtleText: string;
  accent: string;
  accentText: string;
  placeholder: string;
};

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F7F4ED',
    surface: '#FFFEFA',
    preview: '#E8EDE5',
    border: '#D8E0D5',
    text: '#222A22',
    secondaryText: '#526457',
    subtleText: '#728174',
    accent: '#315C46',
    accentText: '#FFFFFF',
    placeholder: '#829184',
  },
  dark: {
    background: '#171B18',
    surface: '#252D27',
    preview: '#222B24',
    border: '#45574B',
    text: '#F7F4EE',
    secondaryText: '#C3CBC1',
    subtleText: '#9BAB9D',
    accent: '#A9CFB1',
    accentText: '#172319',
    placeholder: '#A0AEA2',
  },
};

export default function EditImageModal({
  image,
  onClose,
  onSaved,
}: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = palettes[isDark ? 'dark' : 'light'];
  const styles = useMemo(() => createStyles(colors), [colors]);

  const safeTop = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? 0
  );
  const safeBottom = Math.max(
    insets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  // Refill the editor when the user chooses a different image.
  useEffect(() => {
    if (image) {
      setTitle(image.title);
      setDescription(image.content);
      setTags(image.tags.join(', '));
    }
  }, [image]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleSave() {
    if (!image || saving) return;

    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a title for your image.');
      return;
    }

    setSaving(true);
    try {
      // Only image details change. The original image file stays intact.
      await updateImageMetadata(
        db,
        image.id,
        title,
        description,
        tags.split(',')
      );

      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        'Could not update image',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={image?.type === 'image'}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.screen,
          { paddingTop: safeTop, paddingBottom: safeBottom },
        ]}
      >
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
              accessibilityLabel="Cancel image editing"
            >
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>

            <Text style={styles.heading}>Edit image</Text>

            <Pressable
              style={[styles.headerAction, styles.headerActionRight]}
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save image changes"
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
            <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
            <Text style={styles.title}>A moment worth keeping.</Text>
            <Text style={styles.intro}>
              Give this image a name and a little context so you can find it later.
            </Text>

            <View style={styles.previewContainer}>
              {image?.image_uri ? (
                <Image
                  source={{ uri: image.image_uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                  accessibilityLabel={image.title}
                />
              ) : (
                <Text style={styles.unavailable}>Image unavailable</Text>
              )}
            </View>
            <Text style={styles.previewHint}>
              Your original image will be preserved.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Give your image a title"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                maxLength={150}
                accessibilityLabel="Image title"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What would you like to remember?"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Image description"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>TAGS</Text>
              <TextInput
                style={styles.input}
                value={tags}
                onChangeText={setTags}
                placeholder="inspiration, college, ideas"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                autoCapitalize="none"
                accessibilityLabel="Image tags"
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
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    form: {
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 48,
    },
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
      marginBottom: 22,
    },
    previewContainer: {
      height: 200,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.preview,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewImage: { width: '100%', height: '100%' },
    unavailable: { color: colors.subtleText, fontSize: 14 },
    previewHint: {
      color: colors.subtleText,
      textAlign: 'center',
      fontSize: 12,
      marginTop: 10,
      marginBottom: 22,
    },
    field: { marginTop: 20 },
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
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 52,
      fontSize: 16,
    },
    textArea: { minHeight: 112, paddingTop: 15 },
    hint: {
      color: colors.subtleText,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
    },
  });
}
