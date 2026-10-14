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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useFolioColorScheme } from '@/components/appearance-provider';
import type { SavedItem } from '@/database/items';
import { updateImageMetadata } from '@/database/images';
import {
  deleteStoredImage,
  savePickedImage,
} from '@/utils/image-storage';

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
  secondary: string;
  subtle: string;
  accent: string;
  accentOn: string;
  placeholder: string;
};

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F7F4ED',
    surface: '#FFFEFA',
    preview: '#E8EDE5',
    border: '#D8E0D5',
    text: '#222A22',
    secondary: '#526457',
    subtle: '#728174',
    accent: '#315C46',
    accentOn: '#FFFFFF',
    placeholder: '#829184',
  },
  dark: {
    background: '#171B18',
    surface: '#252D27',
    preview: '#222B24',
    border: '#45574B',
    text: '#F7F4EE',
    secondary: '#C3CBC1',
    subtle: '#9BAB9D',
    accent: '#A9CFB1',
    accentOn: '#172319',
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

  const isDark = useFolioColorScheme() === 'dark';
  const colors = palettes[isDark ? 'dark' : 'light'];

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const [replacement, setReplacement] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const busy = picking || saving;

  useEffect(() => {
    // Reset the form when a different image is opened.
    setTitle(image?.title ?? '');
    setDescription(image?.content ?? '');
    setTags(image?.tags.join(', ') ?? '');
    setReplacement(null);
  }, [image]);

  function handleCancel() {
    if (busy) return;

    // No permanent image copy has been made yet.
    setReplacement(null);
    onClose();
  }

  async function handlePickImage() {
    if (busy || !image) return;

    setPicking(true);

    try {
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1,
          selectionLimit: 1,
        });

      if (!result.canceled && result.assets.length > 0) {
        // Preview the chosen photo without permanently
        // replacing the existing image.
        setReplacement(result.assets[0]);
      }
    } catch (error) {
      Alert.alert(
        'Could not choose image',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setPicking(false);
    }
  }

  async function handleSave() {
    if (!image || busy) return;

    if (!title.trim()) {
      Alert.alert(
        'Missing title',
        'Please enter a title for your image.'
      );
      return;
    }

    setSaving(true);

    let newStoredUri: string | null = null;
    let databaseSaved = false;

    try {
      if (replacement) {
        // Copy the replacement into Folio's private folder.
        newStoredUri = await savePickedImage(replacement);
      }

      // Update the metadata and image location together.
      // The database function also queues the old file
      // for safe cleanup after the transaction commits.
      await updateImageMetadata(
        db,
        image.id,
        title,
        description,
        tags.split(','),
        newStoredUri ?? undefined
      );

      databaseSaved = true;
    } catch (error) {
      Alert.alert(
        'Could not save image',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      // If SQLite couldn't save the replacement,
      // remove the newly copied file.
      //
      // Never delete the original image here.
      if (newStoredUri && !databaseSaved) {
        try {
          deleteStoredImage(newStoredUri);
        } catch (cleanupError) {
          console.warn(
            'Could not remove unsaved replacement:',
            cleanupError
          );
        }
      }

      setSaving(false);
    }

    if (databaseSaved) {
      setReplacement(null);
      onSaved();
      onClose();
    }
  }

  const previewUri =
    replacement?.uri ?? image?.image_uri;

  return (
    <Modal
      visible={image?.type === 'image'}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={
            Platform.OS === 'ios' ? 'padding' : undefined
          }
        >
          <View style={styles.header}>
            <Pressable
              onPress={handleCancel}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel image editing"
              style={styles.headerAction}
            >
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>

            <Text style={styles.headerTitle}>
              Edit image
            </Text>

            <Pressable
              onPress={() => void handleSave()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save image changes"
              style={[
                styles.headerAction,
                styles.headerRight,
              ]}
            >
              <Text
                style={[
                  styles.saveText,
                  busy && styles.dimmed,
                ]}
              >
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === 'ios'
                ? 'interactive'
                : 'on-drag'
            }
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>
              YOUR COLLECTION
            </Text>

            <Text style={styles.title}>
              A moment worth keeping.
            </Text>

            <Text style={styles.intro}>
              Change the photo or its details.
              Nothing changes until you save.
            </Text>

            <View style={styles.previewBox}>
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                  accessibilityLabel="Image preview"
                />
              ) : (
                <Text style={styles.hint}>
                  Image unavailable
                </Text>
              )}
            </View>

            <Pressable
              onPress={() => void handlePickImage()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Change image from photo library"
              style={({ pressed }) => [
                styles.changeButton,
                (busy || pressed) && styles.dimmed,
              ]}
            >
              <Text style={styles.changeButtonText}>
                {picking
                  ? 'Opening Photos…'
                  : 'Change image'}
              </Text>
            </Pressable>

            <Text style={styles.previewHint}>
              {replacement
                ? 'New photo selected. Tap Save to replace the original.'
                : 'Your current photo stays saved until you choose another.'}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>
                TITLE
              </Text>

              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Give your image a title"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={
                  isDark ? 'dark' : 'light'
                }
                maxLength={150}
                editable={!busy}
                accessibilityLabel="Image title"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                DESCRIPTION (OPTIONAL)
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="What would you like to remember?"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={
                  isDark ? 'dark' : 'light'
                }
                multiline
                textAlignVertical="top"
                editable={!busy}
                accessibilityLabel="Image description"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                TAGS
              </Text>

              <TextInput
                style={styles.input}
                value={tags}
                onChangeText={setTags}
                placeholder="inspiration, college, ideas"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={
                  isDark ? 'dark' : 'light'
                }
                autoCapitalize="none"
                editable={!busy}
                accessibilityLabel="Image tags"
              />

              <Text style={styles.hint}>
                Separate tags using commas.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },

    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      minHeight: 64,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    headerAction: {
      minWidth: 72,
      minHeight: 44,
      justifyContent: 'center',
    },

    headerRight: {
      alignItems: 'flex-end',
    },

    headerTitle: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '600',
    },

    cancel: {
      color: colors.secondary,
      fontSize: 15,
    },

    saveText: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: '700',
    },

    dimmed: {
      opacity: 0.5,
    },

    content: {
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 60,
    },

    eyebrow: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2,
    },

    title: {
      color: colors.text,
      fontSize: 29,
      fontWeight: '600',
      letterSpacing: -1,
      marginTop: 12,
    },

    intro: {
      color: colors.secondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
      marginBottom: 22,
    },

    previewBox: {
      height: 215,
      backgroundColor: colors.preview,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 18,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },

    previewImage: {
      width: '100%',
      height: '100%',
    },

    changeButton: {
      alignSelf: 'center',
      marginTop: 15,
      backgroundColor: colors.accent,
      borderRadius: 999,
      paddingHorizontal: 22,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },

    changeButtonText: {
      color: colors.accentOn,
      fontSize: 14,
      fontWeight: '700',
    },

    previewHint: {
      textAlign: 'center',
      color: colors.subtle,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 10,
    },

    field: {
      marginTop: 24,
    },

    label: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.6,
      marginBottom: 10,
    },

    input: {
      minHeight: 52,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },

    textArea: {
      minHeight: 112,
      paddingTop: 15,
    },

    hint: {
      color: colors.subtle,
      fontSize: 12,
      marginTop: 9,
    },
  });
}
