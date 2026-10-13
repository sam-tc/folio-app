
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { updateNote, type SavedItem } from '@/database/items';

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

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  // Fill the form with the selected note's existing data.
  useEffect(() => {
    if (visible && note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags.join(', '));
    }
  }, [visible, note]);

  async function handleSave() {
    if (!note || saving) return;

    if (!title.trim() || !content.trim()) {
      Alert.alert(
        'Missing information',
        'Title and content cannot be empty.'
      );
      return;
    }

    setSaving(true);

    try {
      await updateNote(
        db,
        note.id,
        title,
        content,
        tags.split(',')
      );

      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        'Could not update note',
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (!saving) {
      onClose();
    }
  }

  return (
    <Modal
      visible={visible && note !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable
              onPress={handleClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
            >
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>

            <Text style={styles.heading}>Edit note</Text>

            <Pressable
              onPress={handleSave}
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
          >
            <Text style={styles.label}>TITLE</Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Note title"
              maxLength={150}
              accessibilityLabel="Note title"
            />

            <Text style={styles.label}>YOUR NOTE</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              value={content}
              onChangeText={setContent}
              placeholder="Write your note..."
              multiline
              textAlignVertical="top"
              accessibilityLabel="Note content"
            />

            <Text style={styles.label}>TAGS</Text>

            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="college, ideas, reading"
              autoCapitalize="none"
              accessibilityLabel="Note tags"
            />

            <Text style={styles.hint}>
              Separate multiple tags with commas.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
