import { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
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
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useFolioColorScheme } from '@/components/appearance-provider';
import { createItem } from '@/database/items';
import {
  deleteStoredImage,
  savePickedImage,
} from '@/utils/image-storage';

type Props = {
  visible: boolean;
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
  accent: string;
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
    accent: '#315C46',
    placeholder: '#819084',
  },
  dark: {
    background: '#171B18',
    surface: '#252D27',
    preview: '#222B24',
    border: '#45574B',
    text: '#F7F4EE',
    secondary: '#C3CBC1',
    accent: '#A9CFB1',
    placeholder: '#9EAEA0',
  },
};

export default function CreateImageModal({
  visible,
  onClose,
  onSaved,
}: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const isDark = useFolioColorScheme() === 'dark';
  const colors = palettes[isDark ? 'dark' : 'light'];

  const styles = useMemo(
    () => makeStyles(colors),
    [colors]
  );

  // Keep the modal below the iPhone's status bar.
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

  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const busy = saving || picking;

  function resetForm() {
    setSelectedImage(null);
    setTitle('');
    setDescription('');
    setTags('');
  }

  function handleClose() {
    if (busy) return;

    resetForm();
    onClose();
  }

  async function handlePickImage() {
    if (busy) return;

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
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert(
        'Could not select image',
        error instanceof Error
          ? error.message
          : 'Please choose the image again.'
      );
    } finally {
      setPicking(false);
    }
  }

  async function handleSave() {
    if (busy) return;

    if (!selectedImage) {
      Alert.alert(
        'Choose an image',
        'Select a photo before saving.'
      );
      return;
    }

    if (!title.trim()) {
      Alert.alert(
        'Missing title',
        'Please give this image a title.'
      );
      return;
    }

    setSaving(true);

    let savedUri: string | null = null;
    let databaseSaved = false;

    try {
      // Copy the photo into Folio's private storage.
      savedUri = await savePickedImage(selectedImage);

      // Store the photo's location and details in SQLite.
      await createItem(db, {
        type: 'image',
        title: title.trim(),
        content: description.trim(),
        imageUri: savedUri,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      databaseSaved = true;

      resetForm();
      onClose();
      onSaved();
    } catch (error) {
      // If SQLite fails, remove the unused copied file.
      if (savedUri && !databaseSaved) {
        try {
          deleteStoredImage(savedUri);
        } catch (cleanupError) {
          console.warn(
            'Could not clean up unsaved image:',
            cleanupError
          );
        }
      }

      Alert.alert(
        'Could not save image',
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
      onRequestClose={handleClose}
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
          style={styles.fill}
          behavior={
            Platform.OS === 'ios' ? 'padding' : undefined
          }
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerAction}
              onPress={handleClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel creating image"
            >
              <Text style={styles.secondaryAction}>
                Cancel
              </Text>
            </Pressable>

            <Text style={styles.headerTitle}>
              New image
            </Text>

            <Pressable
              style={[
                styles.headerAction,
                styles.rightAction,
              ]}
              onPress={() => void handleSave()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save image"
            >
              <Text
                style={[
                  styles.saveAction,
                  busy && styles.disabled,
                ]}
              >
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === 'ios'
                ? 'interactive'
                : 'on-drag'
            }
          >
            <Text style={styles.sectionLabel}>
              PHOTO
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.photoArea,
                pressed && !busy && styles.pressed,
              ]}
              onPress={() => void handlePickImage()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={
                selectedImage
                  ? 'Change selected photo'
                  : 'Choose a photo'
              }
            >
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.photo}
                  resizeMode="contain"
                  accessibilityLabel="Selected photo preview"
                />
              ) : (
                <View style={styles.emptyPhoto}>
                  <Text style={styles.plus}>+</Text>

                  <Text style={styles.emptyPhotoTitle}>
                    Choose a photo
                  </Text>

                  <Text style={styles.emptyPhotoHint}>
                    A picture, screenshot or something
                    worth remembering.
                  </Text>
                </View>
              )}
            </Pressable>

            {selectedImage ? (
              <Pressable
                style={styles.changePhotoButton}
                onPress={() => void handlePickImage()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Choose a different photo"
              >
                <Text style={styles.changePhotoText}>
                  {picking
                    ? 'Opening Photos…'
                    : 'Change photo'}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.sectionLabel}>
                TITLE
              </Text>

              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                editable={!busy}
                placeholder="Give this image a name"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={
                  isDark ? 'dark' : 'light'
                }
                maxLength={150}
                accessibilityLabel="Image title"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.sectionLabel}>
                DESCRIPTION (OPTIONAL)
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.description,
                ]}
                value={description}
                onChangeText={setDescription}
                editable={!busy}
                placeholder="What would you like to remember?"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={
                  isDark ? 'dark' : 'light'
                }
                multiline
                textAlignVertical="top"
                accessibilityLabel="Image description"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.sectionLabel}>
                TAGS
              </Text>

              <TextInput
                style={styles.input}
                value={tags}
                onChangeText={setTags}
                editable={!busy}
                placeholder="inspiration, college, ideas"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.accent}
                keyboardAppearance={
                  isDark ? 'dark' : 'light'
                }
                autoCapitalize="none"
                accessibilityLabel="Image tags"
              />

              <Text style={styles.helpText}>
                Separate tags with commas.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    fill: {
      flex: 1,
    },

    screen: {
      flex: 1,
      backgroundColor: c.background,
    },

    header: {
      height: 64,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
    },

    secondaryAction: {
      color: c.secondary,
      fontSize: 15,
    },

    saveAction: {
      color: c.accent,
      fontSize: 15,
      fontWeight: '700',
    },

    disabled: {
      opacity: 0.45,
    },

    form: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 50,
    },

    sectionLabel: {
      color: c.secondary,
      fontSize: 11,
      letterSpacing: 1.6,
      fontWeight: '700',
      marginBottom: 10,
    },

    photoArea: {
      height: 218,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.preview,
      borderRadius: 18,
      overflow: 'hidden',
    },

    pressed: {
      opacity: 0.8,
    },

    photo: {
      width: '100%',
      height: '100%',
    },

    emptyPhoto: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 25,
    },

    plus: {
      color: c.accent,
      fontSize: 36,
      fontWeight: '300',
      marginBottom: 2,
    },

    emptyPhotoTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
    },

    emptyPhotoHint: {
      color: c.secondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 7,
    },

    changePhotoButton: {
      minHeight: 44,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },

    changePhotoText: {
      color: c.accent,
      fontSize: 14,
      fontWeight: '600',
    },

    field: {
      marginTop: 22,
    },

    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 14,
      fontSize: 16,
      minHeight: 52,
    },

    description: {
      minHeight: 108,
      paddingTop: 14,
    },

    helpText: {
      color: c.secondary,
      fontSize: 12,
      marginTop: 9,
    },
  });
}
