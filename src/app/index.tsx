
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CreateNoteModal from '@/components/create-note-modal';
import SavedItemsList from '@/components/saved-items-list';

import EditNoteModal from '@/components/edit-note-modal';
import type { SavedItem } from '@/database/items';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // Colors for light and dark appearance
  const palette = {
    background: isDark ? '#171B18' : '#F7F4ED',
    text: isDark ? '#F7F4EE' : '#222A22',
    secondary: isDark ? '#C3CBC1' : '#526457',
    accent: isDark ? '#F0BE8C' : '#8A4B32',
  };

  // Controls whether the Create Note modal is open
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);

  // Used to refresh the library after saving a note
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedNote, setSelectedNote] =
    useState<SavedItem | null>(null);

  function handleNoteSaved() {
    // Trigger SavedItemsList to fetch updated SQLite data
    setRefreshKey((current) => current + 1);

    Alert.alert(
      'Note saved',
      'Your note was saved successfully.'
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: palette.background },
      ]}
    >
      {/* App branding */}
      <View style={styles.header}>
        <Text
          style={[
            styles.wordmark,
            { color: palette.text },
          ]}
        >
          folio.
        </Text>

        <Text
          style={[
            styles.eyebrow,
            { color: palette.accent },
          ]}
        >
          YOUR PERSONAL LIBRARY
        </Text>

        <View
          style={[
            styles.accentRule,
            { backgroundColor: palette.accent },
          ]}
        />
      </View>

      {/* Library content */}
      <View style={styles.content}>
        <Text
          style={[
            styles.heading,
            { color: palette.text },
          ]}
        >
          Good things are worth keeping.
        </Text>

        <Text
          style={[
            styles.description,
            { color: palette.secondary },
          ]}
        >
          A quiet home for the notes, links, images, and ideas
          you want to come back to.
        </Text>

        {/* Open the Create Note form */}
        <Pressable
          style={styles.newNoteButton}
          onPress={() => setIsNoteModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Create a new note"
        >
          <Text style={styles.newNoteButtonText}>
            + New Note
          </Text>
        </Pressable>

        {/* Display actual saved items from SQLite */}
        <SavedItemsList
          refreshKey={refreshKey}
          onSelectNote={setSelectedNote}
        />
      </View>

      {/* Note creation form */}
      <CreateNoteModal
        visible={isNoteModalVisible}
        onClose={() => setIsNoteModalVisible(false)}
        onSaved={handleNoteSaved}
      />

      <EditNoteModal
        visible={selectedNote !== null}
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onSaved={() => {
          setRefreshKey((current) => current + 1);
        }}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 26,
  },

  header: {
    paddingTop: 30,
    gap: 12,
  },

  wordmark: {
    fontSize: 36,
    fontWeight: '600',
    letterSpacing: -2,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },

  accentRule: {
    width: 42,
    height: 3,
    borderRadius: 999,
    marginTop: 8,
  },

  content: {
    flex: 1,
    paddingTop: 35,
    minHeight: 0,
  },

  heading: {
    fontSize: 40,
    fontWeight: '500',
    lineHeight: 47,
    letterSpacing: -1.8,
    maxWidth: 330,
  },

  description: {
    fontSize: 15,
    lineHeight: 24,
    marginTop: 18,
    maxWidth: 315,
  },

  newNoteButton: {
    backgroundColor: '#315C46',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 28,
  },

  newNoteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
