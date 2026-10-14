import { useEffect, useState } from 'react';
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

import {
  updateLink,
  updateNote,
  type SavedItem,
} from '@/database/items';

type Props = {
  visible: boolean;
  note: SavedItem | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditNoteModal({
  visible,
  note,
  onClose,
  onSaved,
}: Props) {
  const db = useSQLiteContext();

  // Read the safe area from the main app, outside the Modal.
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
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const isLink = note?.type === 'link';

  useEffect(() => {
    if (visible && note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags.join(', '));
    }
  }, [visible, note]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleSave() {
    if (!note || saving) return;

    if (!title.trim() || !content.trim()) {
      Alert.alert(
        'Missing information',
        isLink
          ? 'Please enter a title and website URL.'
          : 'Title and content cannot be empty.'
      );
      return;
    }

    setSaving(true);

    try {
      const cleanTags = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      if (note.type === 'link') {
        await updateLink(
          db,
          note.id,
          title,
          content,
          cleanTags
        );
      } else if (note.type === 'note') {
        await updateNote(
          db,
          note.id,
          title,
          content,
          cleanTags
        );
      } else {
        throw new Error(
          'This item cannot be edited using the note editor.'
        );
      }

      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        isLink ? 'Could not update link' : 'Could not update note',
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
      visible={visible && note !== null}
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerAction}
              onPress={handleClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
            >
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>

            <Text style={styles.heading}>
              {isLink ? 'Edit link' : 'Edit note'}
            </Text>

            <Pressable
              style={[
                styles.headerAction,
                styles.headerActionRight,
              ]}
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
            >
              <Text style={styles.save}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Text style={styles.label}>TITLE</Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={isLink ? 'Link title' : 'Note title'}
              placeholderTextColor="#858585"
              maxLength={150}
              accessibilityLabel={isLink ? 'Link title' : 'Note title'}
            />

            <Text style={styles.label}>
              {isLink ? 'WEBSITE URL' : 'YOUR NOTE'}
            </Text>

            <TextInput
              style={[
                styles.input,
                !isLink && styles.textArea,
              ]}
              value={content}
              onChangeText={setContent}
              placeholder={
                isLink
                  ? 'https://example.com'
                  : 'Write your note...'
              }
              placeholderTextColor="#858585"
              multiline={!isLink}
              textAlignVertical={isLink ? undefined : 'top'}
              keyboardType={isLink ? 'url' : 'default'}
              autoCapitalize={isLink ? 'none' : 'sentences'}
              autoCorrect={!isLink}
              accessibilityLabel={
                isLink ? 'Website URL' : 'Note content'
              }
            />

            {isLink && (
              <Text style={styles.hint}>
                You can also enter a domain like github.com.
              </Text>
            )}

            <Text style={styles.label}>TAGS</Text>

            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="college, ideas, reading"
              placeholderTextColor="#858585"
              autoCapitalize="none"
              accessibilityLabel="Item tags"
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
    padding: 24,
    gap: 12,
    paddingBottom: 48,
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#555555',
    marginTop: 16,
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
    minHeight: 180,
  },

  hint: {
    fontSize: 12,
    color: '#666666',
  },
});
