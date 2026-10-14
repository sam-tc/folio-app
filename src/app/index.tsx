
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
import EditNoteModal from '@/components/edit-note-modal';
import SavedItemsList from '@/components/saved-items-list';

import type { SavedItem } from '@/database/items';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';

  const palette = {
    background: isDark ? '#171B18' : '#F7F4ED',
    text: isDark ? '#F7F4EE' : '#222A22',
    secondary: isDark ? '#C3CBC1' : '#526457',
    accent: isDark ? '#F0BE8C' : '#8A4B32',
  };

  // 'note' opens the Note form.
  // 'link' opens the Link form.
  // null means the creation form is closed.
  const [creatingType, setCreatingType] =
    useState<'note' | 'link' | null>(null);

  // Refresh Library after creating or editing an item.
  const [refreshKey, setRefreshKey] = useState(0);

  // The selected note for the editing modal.
  const [selectedNote, setSelectedNote] =
    useState<SavedItem | null>(null);

  function handleItemSaved() {
    setRefreshKey((current) => current + 1);

    const isLink = creatingType === 'link';

    Alert.alert(
      isLink ? 'Link saved' : 'Note saved',
      isLink
        ? 'Your link was saved successfully.'
        : 'Your note was saved successfully.'
    );
  }

  function handleNoteEdited() {
    setRefreshKey((current) => current + 1);
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: palette.background },
      ]}
    >
      {/* Folio branding */}
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

      {/* Main Library */}
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

        {/* Creation buttons */}
        <View style={styles.createButtons}>
          <Pressable
            style={styles.newNoteButton}
            onPress={() => setCreatingType('note')}
            accessibilityRole="button"
            accessibilityLabel="Create a new note"
          >
            <Text style={styles.newNoteButtonText}>
              + New Note
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.newLinkButton,
              { borderColor: palette.secondary },
            ]}
            onPress={() => setCreatingType('link')}
            accessibilityRole="button"
            accessibilityLabel="Create a new link"
          >
            <Text
              style={[
                styles.newLinkButtonText,
                { color: palette.text },
              ]}
            >
              + New Link
            </Text>
          </Pressable>
        </View>

        {/* Notes and links saved in SQLite */}
        <SavedItemsList
          refreshKey={refreshKey}
          onSelectNote={setSelectedNote}
        />
      </View>

      {/* Reusable Note / Link creation modal */}
      <CreateNoteModal
        visible={creatingType !== null}
        itemType={creatingType ?? 'note'}
        onClose={() => setCreatingType(null)}
        onSaved={handleItemSaved}
      />

      {/* Existing note editing modal */}
      <EditNoteModal
        visible={selectedNote !== null}
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onSaved={handleNoteEdited}
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

  createButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },

  newNoteButton: {
    flex: 1,
    backgroundColor: '#315C46',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  newNoteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  newLinkButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  newLinkButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
