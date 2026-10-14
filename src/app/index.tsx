import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CreateNoteModal from '@/components/create-note-modal';
import CreateImageModal from '@/components/create-image-modal';
import EditNoteModal from '@/components/edit-note-modal';
import ImageViewerModal from '@/components/image-viewer-modal';
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

  const [creatingType, setCreatingType] =
    useState<'note' | 'link' | null>(null);

  const [isImageModalVisible, setIsImageModalVisible] =
    useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedNote, setSelectedNote] =
    useState<SavedItem | null>(null);

  const [selectedImageItem, setSelectedImageItem] =
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

  function handleImageSaved() {
    setRefreshKey((current) => current + 1);

    Alert.alert(
      'Image saved',
      'Your image has been added to Folio.'
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
      {/* Fixed Folio branding */}
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

      {/* Scrollable Home content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Create Note and Link */}
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

        {/* Create Image */}
        <Pressable
          style={[
            styles.newImageButton,
            { borderColor: palette.secondary },
          ]}
          onPress={() => setIsImageModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Create a new image"
        >
          <Text
            style={[
              styles.newImageButtonText,
              { color: palette.text },
            ]}
          >
            + New Image
          </Text>
        </Pressable>

        {/* Saved Library */}
        <SavedItemsList
          refreshKey={refreshKey}
          onSelectNote={setSelectedNote}
          onSelectImage={setSelectedImageItem}
        />
      </ScrollView>

      {/* Create Note / Link */}
      <CreateNoteModal
        visible={creatingType !== null}
        itemType={creatingType ?? 'note'}
        onClose={() => setCreatingType(null)}
        onSaved={handleItemSaved}
      />

      {/* Create Image */}
      <CreateImageModal
        visible={isImageModalVisible}
        onClose={() => setIsImageModalVisible(false)}
        onSaved={handleImageSaved}
      />

      {/* Edit Note / Link */}
      <EditNoteModal
        visible={selectedNote !== null}
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onSaved={handleNoteEdited}
      />

      {/* Full-screen Image Viewer */}
      <ImageViewerModal
        image={selectedImageItem}
        onClose={() => setSelectedImageItem(null)}
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
    paddingTop: 18,
    paddingBottom: 12,
    gap: 8,
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

  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    paddingTop: 28,
    paddingBottom: 72,
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

  newImageButton: {
    marginTop: 10,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  newImageButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
