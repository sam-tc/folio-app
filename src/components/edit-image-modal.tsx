import { useEffect, useState } from 'react';
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
import { useSQLiteContext } from 'expo-sqlite';

import type { SavedItem } from '@/database/items';
import { updateImageMetadata } from '@/database/images';

type Props = {
  image: SavedItem | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditImageModal({
  image,
  onClose,
  onSaved,
}: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

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

  // Fill the form with the saved image's existing details.
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
      Alert.alert(
        'Missing title',
        'Please enter a title for your image.'
      );
      return;
    }

    setSaving(true);

    try {
      await updateImageMetadata(
        db,
        image.id,
        title,
        description,
        tags.split(',')
      );

      // Refresh the Library, then close the editor.
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        'Could not update image',
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
      visible={image?.type === 'image'}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
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
          style={styles.flex}
          behavior={
            Platform.OS === 'ios' ? 'padding' : undefined
          }
        >
          {/* Header */}
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

            <Text style={styles.heading}>
              Edit image
            </Text>

            <Pressable
              style={[
                styles.headerAction,
                styles.headerActionRight,
              ]}
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save image changes"
            >
              <Text style={styles.save}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          {/* Editable image details */}
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Text style={styles.sectionLabel}>
              YOUR IMAGE
            </Text>

            <View style={styles.previewContainer}>
              {image?.image_uri ? (
                <Image
                  source={{ uri: image.image_uri }}
                  style={styles.preview}
                  resizeMode="contain"
                  accessibilityLabel={image.title}
                />
              ) : (
                <Text style={styles.unavailable}>
                  Image unavailable
                </Text>
              )}
            </View>

            <Text style={styles.previewHint}>
              Your original image will be preserved.
            </Text>

            <Text style={styles.sectionLabel}>
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

            <Text style={styles.sectionLabel}>
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
              placeholderTextColor="#858585"
              multiline
              textAlignVertical="top"
              accessibilityLabel="Image description"
            />

            <Text style={styles.sectionLabel}>
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
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
    minHeight: 64,
  },

  headerAction: {
    minWidth: 72,
    minHeight: 44,
    justifyContent: 'center',
  },

  headerActionRight: {
    alignItems: 'flex-end',
  },

  heading: {
    fontSize: 17,
    fontWeight: '600',
    color: '#202020',
    textAlign: 'center',
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 12,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#555555',
    marginTop: 12,
  },

  previewContainer: {
    height: 190,
    backgroundColor: '#EDF2EC',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  preview: {
    width: '100%',
    height: '100%',
  },

  unavailable: {
    fontSize: 14,
    color: '#66786B',
  },

  previewHint: {
    fontSize: 12,
    color: '#66786B',
    textAlign: 'center',
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5D5CF',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#202020',
  },

  textArea: {
    minHeight: 110,
  },

  hint: {
    fontSize: 12,
    color: '#666666',
  },
});
