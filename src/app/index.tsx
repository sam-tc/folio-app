import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CreateNoteModal from '@/components/create-note-modal';
import CreateImageModal from '@/components/create-image-modal';
import EditNoteModal from '@/components/edit-note-modal';
import ImageViewerModal from '@/components/image-viewer-modal';
import SavedItemsList from '@/components/saved-items-list';
import SettingsModal from '@/components/settings-modal';

import type { SavedItem } from '@/database/items';
import type { LibraryFilter } from '@/database/search';

const FILTER_OPTIONS: { label: string; value: LibraryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Notes', value: 'note' },
  { label: 'Links', value: 'link' },
  { label: 'Images', value: 'image' },
  { label: 'Tagged', value: 'tagged' },
];

type NewItemType = 'note' | 'link' | 'image';

const NEW_ITEM_OPTIONS: {
  type: NewItemType;
  number: string;
  title: string;
  description: string;
}[] = [
  { type: 'note', number: '01', title: 'Note', description: 'Keep a thought or idea' },
  { type: 'link', number: '02', title: 'Link', description: 'Save a page for later' },
  { type: 'image', number: '03', title: 'Image', description: 'Keep a visual reference' },
];

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';

  const palette = {
    background: isDark ? '#171B18' : '#F7F4ED',
    text: isDark ? '#F7F4EE' : '#222A22',
    secondary: isDark ? '#B9C4B9' : '#526457',
    muted: isDark ? '#92A092' : '#748173',
    accent: isDark ? '#E6BA8A' : '#936D47',
    border: isDark ? '#3E4C41' : '#D6DED2',
    surface: isDark ? '#222A24' : '#FFFEFA',
    primary: isDark ? '#476F55' : '#315C46',
    placeholder: isDark ? '#8E9B91' : '#89958A',
  };

  const [creatingType, setCreatingType] =
    useState<'note' | 'link' | null>(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [addExpanded, setAddExpanded] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedNote, setSelectedNote] = useState<SavedItem | null>(null);
  const [selectedImageItem, setSelectedImageItem] =
    useState<SavedItem | null>(null);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFilter, setSelectedFilter] =
    useState<LibraryFilter>('all');
  const [searchExpanded, setSearchExpanded] = useState(false);

  const hasSearchCriteria =
    searchText.trim().length > 0 || selectedFilter !== 'all';

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchText), 180);
    return () => clearTimeout(timeout);
  }, [searchText]);

  function clearSearch() {
    setSearchText('');
    setDebouncedSearch('');
    setSelectedFilter('all');
  }

  function startCreating(type: NewItemType) {
    setAddExpanded(false);
    if (type === 'image') {
      setIsImageModalVisible(true);
    } else {
      setCreatingType(type);
    }
  }

  function handleItemSaved() {
    setRefreshKey((value) => value + 1);
    const isLink = creatingType === 'link';
    Alert.alert(
      isLink ? 'Link saved' : 'Note saved',
      isLink
        ? 'Your link was saved successfully.'
        : 'Your note was saved successfully.'
    );
  }

  function handleImageSaved() {
    setRefreshKey((value) => value + 1);
    Alert.alert('Image saved', 'Your image has been added to Folio.');
  }

  function handleNoteEdited() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      {/* Keep the Folio identity visible while the Library scrolls. */}
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <Text style={[styles.wordmark, { color: palette.text }]}>folio.</Text>
          <Text style={[styles.headerCaption, { color: palette.accent }]}>
            YOUR PERSONAL LIBRARY
          </Text>
        </View>
        <Pressable
          onPress={() => setSettingsVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Folio Settings"
          style={({ pressed }) => [
            styles.settingsButton,
            { borderColor: palette.border, backgroundColor: palette.surface, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.settingsGlyph, { color: palette.text }]}>Settings</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* A short welcome leaves room to see real saved items sooner. */}
        <View style={styles.intro}>
          <Text style={[styles.heading, { color: palette.text }]}>
            Worth keeping.
          </Text>
          <Text style={[styles.description, { color: palette.secondary }]}>
            A home for the things you want to come back to.
          </Text>
        </View>

        {/* One intentional creation action replaces three large buttons. */}
        <Pressable
          onPress={() => setAddExpanded((value) => !value)}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            addExpanded ? 'Close Add to Folio menu' : 'Open Add to Folio menu'
          }
          accessibilityState={{ expanded: addExpanded }}
        >
          <Text style={styles.addButtonText}>
            {addExpanded ? 'Choose what to save' : 'Add to Folio'}
          </Text>
          <Text style={styles.addButtonGlyph} accessibilityElementsHidden>
            {addExpanded ? '×' : '+'}
          </Text>
        </Pressable>

        {addExpanded && (
          <View
            style={[
              styles.addMenu,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            {NEW_ITEM_OPTIONS.map((option, index) => (
              <Pressable
                key={option.type}
                onPress={() => startCreating(option.type)}
                style={({ pressed }) => [
                  styles.addMenuOption,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: palette.border,
                  },
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Create a new ${option.title.toLowerCase()}`}
              >
                <Text style={[styles.addMenuNumber, { color: palette.accent }]}>
                  {option.number}
                </Text>
                <View style={styles.addMenuCopy}>
                  <Text style={[styles.addMenuTitle, { color: palette.text }]}>
                    {option.title}
                  </Text>
                  <Text
                    style={[styles.addMenuDescription, { color: palette.secondary }]}
                  >
                    {option.description}
                  </Text>
                </View>
                <Text style={[styles.addMenuArrow, { color: palette.secondary }]}>
                  ↗
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Search stays compact unless someone actually needs it. */}
        <View style={styles.collectionSection}>
          <View style={styles.collectionHeadingRow}>
            <View style={styles.collectionHeadingCopy}>
              <Text style={[styles.collectionLabel, { color: palette.accent }]}>
                THE LIBRARY
              </Text>
              <Text style={[styles.collectionTitle, { color: palette.text }]}>
                Your collection
              </Text>
            </View>
            <Pressable
              onPress={() => setSearchExpanded((value) => !value)}
              style={({ pressed }) => [
                styles.searchToggle,
                {
                  borderColor: palette.border,
                  backgroundColor: searchExpanded ? palette.primary : palette.surface,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                searchExpanded
                  ? 'Close library search and filters'
                  : 'Open library search and filters'
              }
              accessibilityState={{ expanded: searchExpanded }}
            >
              <Text
                style={[
                  styles.searchToggleText,
                  { color: searchExpanded ? '#FFFFFF' : palette.text },
                ]}
              >
                {searchExpanded ? 'Close' : 'Search'}
              </Text>
              <Text
                style={[
                  styles.searchToggleGlyph,
                  { color: searchExpanded ? '#FFFFFF' : palette.text },
                ]}
                accessibilityElementsHidden
              >
                {searchExpanded ? '−' : '+'}
              </Text>
            </Pressable>
          </View>

          {hasSearchCriteria && (
            <View style={styles.activeSearchRow}>
              <Text
                style={[styles.activeSearchText, { color: palette.secondary }]}
                numberOfLines={1}
              >
                {searchText.trim() ? `“${searchText.trim()}”` : 'All items'}
                {selectedFilter !== 'all'
                  ? ` · ${FILTER_OPTIONS.find(
                      (option) => option.value === selectedFilter
                    )?.label ?? 'Filtered'}`
                  : ''}
              </Text>
              <Pressable
                onPress={clearSearch}
                style={styles.resetButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search and filters"
              >
                <Text style={[styles.resetText, { color: palette.accent }]}>
                  Clear all
                </Text>
              </Pressable>
            </View>
          )}

          {searchExpanded && (
            <View style={styles.searchControls}>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <TextInput
                  style={[styles.searchInput, { color: palette.text }]}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Title, text, URL or tag"
                  placeholderTextColor={palette.placeholder}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Search your library"
                />
                {searchText.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setSearchText('');
                      setDebouncedSearch('');
                    }}
                    style={styles.clearButton}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search text"
                    hitSlop={8}
                  >
                    <Text style={[styles.clearText, { color: palette.secondary }]}>
                      ×
                    </Text>
                  </Pressable>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.filterRow}
                style={styles.filterScroll}
              >
                {FILTER_OPTIONS.map((option) => {
                  const selected = selectedFilter === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setSelectedFilter(option.value)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selected ? palette.primary : 'transparent',
                          borderColor: selected ? palette.primary : palette.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Filter by ${option.label}`}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          { color: selected ? '#FFFFFF' : palette.secondary },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        <SavedItemsList
          refreshKey={refreshKey}
          searchQuery={debouncedSearch}
          filter={selectedFilter}
          onSelectNote={setSelectedNote}
          onSelectImage={setSelectedImageItem}
        />
      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <CreateNoteModal
        visible={creatingType !== null}
        itemType={creatingType ?? 'note'}
        onClose={() => setCreatingType(null)}
        onSaved={handleItemSaved}
      />
      <CreateImageModal
        visible={isImageModalVisible}
        onClose={() => setIsImageModalVisible(false)}
        onSaved={handleImageSaved}
      />
      <EditNoteModal
        visible={selectedNote !== null}
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onSaved={handleNoteEdited}
      />
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
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(135,155,135,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerIdentity: { flex: 1, gap: 1 },
  settingsButton: {
    minWidth: 79,
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsGlyph: { fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
  wordmark: {
    fontSize: 35,
    fontWeight: '700',
    letterSpacing: -2,
  },
  headerCaption: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginTop: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 22,
    paddingBottom: 22,
  },
  intro: {
    gap: 7,
  },
  heading: {
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 39,
    letterSpacing: -0.8,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 320,
  },
  addButton: {
    marginTop: 20,
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  addButtonGlyph: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 30,
  },
  addMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  addMenuOption: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    paddingVertical: 12,
    gap: 14,
  },
  addMenuNumber: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    width: 23,
  },
  addMenuCopy: {
    flex: 1,
    gap: 2,
  },
  addMenuTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  addMenuDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  addMenuArrow: {
    fontSize: 20,
  },
  collectionSection: {
    marginTop: 30,
  },
  collectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  collectionHeadingCopy: {
    flex: 1,
    gap: 3,
  },
  collectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  collectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  searchToggle: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
  },
  searchToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchToggleGlyph: {
    fontSize: 19,
    fontWeight: '400',
  },
  activeSearchRow: {
    marginTop: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  activeSearchText: {
    fontSize: 12,
    flex: 1,
  },
  resetButton: {
    minHeight: 38,
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchControls: {
    marginTop: 13,
  },
  searchBox: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  clearButton: {
    minWidth: 30,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  clearText: {
    fontSize: 24,
    lineHeight: 28,
  },
  filterScroll: {
    marginTop: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  filterChip: {
    minHeight: 39,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
