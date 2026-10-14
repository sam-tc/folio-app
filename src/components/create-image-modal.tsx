
import { useState } from 'react';
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
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';

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

export default function CreateImageModal({
  visible,
  onClose,
  onSaved,
}: Props) {
  const db = useSQLiteContext();

  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  function resetForm() {
    setSelectedImage(null);
    setTitle('');
    setDescription('');
    setTags('');
  }

  function handleClose() {
    if (saving || picking) return;

    resetForm();
    onClose();
  }

  async function handlePickImage() {
    if (saving || picking) return;

    setPicking(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
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
          : 'Please try selecting the image again.'
      );
    } finally {
      setPicking(false);
    }
  }

  async function handleSave() {
    if (saving || picking) return;

    if (!selectedImage) {
      Alert.alert(
        'No image selected',
        'Please choose an image before saving.'
      );
      return;
    }

    if (!title.trim()) {
      Alert.alert(
        'Missing title',
        'Please enter a title for your image.'
      );
      return;
    }

    setSaving(true);

    let savedUri: string | null = null;
    let databaseSaved = false;

    try {
      // Copy the selected image into permanent app storage.
      savedUri = await savePickedImage(selectedImage);

      // Save its metadata and file URI in SQLite.
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
      // Only remove the copied file if SQLite did not save it.
      if (savedUri && !databaseSaved) {
        try {
          deleteStoredImage(savedUri);
        } catch (cleanupError) {
          console.warn(
            'Could not clean up image after save failure:',
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
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={
              Platform.OS === 'ios' ? 'padding' : undefined
            }
          >
            <View style={styles.header}>
              <Pressable
                onPress={handleClose}
                disabled={saving || picking}
                accessibilityRole="button"
              >
                <Text style={styles.cancel}>
                  Cancel
                </Text>
              </Pressable>

              <Text style={styles.heading}>
                New image
              </Text>

              <Pressable
                onPress={() => void handleSave()}
                disabled={saving || picking}
                accessibilityRole="button"
              >
                <Text style={styles.save}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
            >
              {/* Image selection and preview */}
              <Pressable
                style={styles.imagePicker}
                onPress={() => void handlePickImage()}
                disabled={saving || picking}
                accessibilityRole="button"
                accessibilityLabel="Choose an image"
              >
                {selectedImage ? (
                  <Image
                    source={{ uri: selectedImage.uri }}
                    style={styles.preview}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.placeholder}>
                    <Text style={styles.placeholderSymbol}>
                      +
                    </Text>

                    <Text style={styles.placeholderTitle}>
                      Choose an image
                    </Text>

                    <Text style={styles.placeholderDescription}>
                      Select a photo or screenshot from your library.
                    </Text>
                  </View>
                )}
              </Pressable>

              {selectedImage && (
                <Pressable
                  onPress={() => void handlePickImage()}
                  disabled={saving || picking}
                  accessibilityRole="button"
                >
                  <Text style={styles.changeImage}>
                    Change image
                  </Text>
                </Pressable>
              )}

              {/* Image title */}
              <Text style={styles.label}>
                TITLE
              </Text>

              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Give your image a title"
                placeholderTextColor="#858585"
                maxLength={150}
                accessibilityLabel="Image title"
              />

              {/* Optional description */}
              <Text style={styles.label}>
                DESCRIPTION (OPTIONAL)
              </Text>

              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What would you like to remember?"
                placeholderTextColor="#858585"
                multiline
                textAlignVertical="top"
                accessibilityLabel="Image description"
              />

              {/* Image tags */}
              <Text style={styles.label}>
                TAGS
              </Text>

              <TextInput
                style={styles.input}
                value={tags}
                onChangeText={setTags}
                placeholder="inspiration, college, ideas"
                placeholderTextColor="#858585"
                autoCapitalize="none"
                accessibilityLabel="Image tags"
              />

              <Text style={styles.hint}>
                Separate multiple tags with commas.
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
  },

  heading: {
    fontSize: 17,
    fontWeight: '600',
    color: '#202020',
  },

  cancel: {
    fontSize: 15,
    color: '#555555',
  },

  save: {
    fontSize: 15,
    fontWeight: '700',
    color: '#315C46',
  },

  form: {
    padding: 24,
    gap: 12,
  },

  imagePicker: {
    height: 230,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A3B5A7',
    backgroundColor: '#EDF2EC',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },

  preview: {
    width: '100%',
    height: '100%',
  },

  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },

  placeholderSymbol: {
    fontSize: 40,
    fontWeight: '300',
    color: '#315C46',
  },

  placeholderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#315C46',
  },

  placeholderDescription: {
    fontSize: 13,
    textAlign: 'center',
    color: '#66786B',
    lineHeight: 20,
  },

  changeImage: {
    fontSize: 14,
    color: '#315C46',
    fontWeight: '600',
    textAlign: 'center',
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#555555',
    marginTop: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: '#D5D5CF',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#202020',
  },

  textArea: {
    minHeight: 90,
  },

  hint: {
    fontSize: 12,
    color: '#666666',
  },
});
