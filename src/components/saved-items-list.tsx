import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import {
  archiveItem,
  moveToRecentlyDeleted,
  type SavedItem,
} from '@/database/items';

import {
  searchLibraryItems,
  type LibraryFilter,
} from '@/database/search';

import { ItemActionsMenu } from '@/components/item-actions-menu';
import EditImageModal from '@/components/edit-image-modal';

type Props = {
  refreshKey: number;
  searchQuery: string;
  filter: LibraryFilter;
  onSelectNote: (item: SavedItem) => void;
  onSelectImage: (item: SavedItem) => void;
};

export default function SavedItemsList({
  refreshKey,
  searchQuery,
  filter,
  onSelectNote,
  onSelectImage,
}: Props) {
  const db = useSQLiteContext();
  const isDark = useColorScheme() === 'dark';

  const [items, setItems] = useState<SavedItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  // The image currently being edited.
  const [editingImage, setEditingImage] =
    useState<SavedItem | null>(null);

  const textColor = isDark ? '#F5F5F0' : '#222A22';
  const secondaryColor = isDark ? '#C3CBC1' : '#526457';
  const borderColor = isDark ? '#48594D' : '#D3DBD0';

  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasActiveFilter = filter !== 'all';
  const isSearching = hasActiveSearch || hasActiveFilter;

  // Refresh Library when the screen gains focus,
  // when an item changes, or when Search changes.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadItems() {
        try {
          const results = await searchLibraryItems(
            db,
            searchQuery,
            filter
          );

          if (active) {
            setItems(results);
            setError(null);
            setHasLoaded(true);
          }
        } catch (err) {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : 'Failed to search your library.'
            );

            setHasLoaded(true);
          }
        }
      }

      void loadItems();

      return () => {
        active = false;
      };
    }, [
      db,
      refreshKey,
      localRefreshKey,
      searchQuery,
      filter,
    ])
  );

  async function handleCardPress(item: SavedItem) {
    if (item.type === 'note') {
      onSelectNote(item);
      return;
    }

    if (item.type === 'image') {
      onSelectImage(item);
      return;
    }

    if (item.type === 'link') {
      try {
        await Linking.openURL(item.content);
      } catch {
        Alert.alert(
          'Could not open link',
          'This website could not be opened.'
        );
      }
    }
  }

  // Notes and Links use the existing editor.
  // Images use the new image metadata editor.
  function handleEdit(item: SavedItem) {
    if (item.type === 'image') {
      setEditingImage(item);
    } else {
      onSelectNote(item);
    }
  }

  function handleImageSaved() {
    // Reload cards so the updated image details appear.
    setLocalRefreshKey((current) => current + 1);
  }

  async function confirmArchive(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await archiveItem(db, item.id);

      setLocalRefreshKey((current) => current + 1);
    } catch (err) {
      Alert.alert(
        'Archive failed',
        err instanceof Error
          ? err.message
          : 'Could not archive this item.'
      );
    } finally {
      setBusyItemId(null);
    }
  }

  function handleArchive(item: SavedItem) {
    if (busyItemId !== null) return;

    Alert.alert(
      'Archive this item?',
      `"${item.title}" will move to Archive. You can restore it later.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Archive',
          onPress: () => {
            void confirmArchive(item);
          },
        },
      ]
    );
  }

  async function moveItemToTrash(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await moveToRecentlyDeleted(db, item.id);

      setLocalRefreshKey((current) => current + 1);
    } catch (err) {
      Alert.alert(
        'Delete failed',
        err instanceof Error
          ? err.message
          : 'Could not move this item to Recently Deleted.'
      );
    } finally {
      setBusyItemId(null);
    }
  }

  function handleMoveToTrash(item: SavedItem) {
    if (busyItemId !== null) return;

    Alert.alert(
      'Move to Recently Deleted?',
      'You can recover this item within 30 days. After that, it will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: () => {
            void moveItemToTrash(item);
          },
        },
      ]
    );
  }

  if (!hasLoaded) {
    return (
      <Text
        style={[
          styles.statusText,
          { color: secondaryColor },
        ]}
      >
        Loading library...
      </Text>
    );
  }

  if (error) {
    return (
      <View style={styles.messageContainer}>
        <Text
          style={[
            styles.itemTitle,
            { color: textColor },
          ]}
        >
          Couldn't load your library
        </Text>

        <Text style={{ color: secondaryColor }}>
          {error}
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View
        style={[
          styles.emptyState,
          { borderColor },
        ]}
      >
        <Text
          style={[
            styles.itemTitle,
            { color: textColor },
          ]}
        >
          {isSearching
            ? 'No matching items'
            : 'Your library starts here'}
        </Text>

        <Text
          style={[
            styles.emptyDescription,
            { color: secondaryColor },
          ]}
        >
          {isSearching
            ? 'Try a different search or select another filter.'
            : 'Nothing saved yet. Your collection will appear here.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Text
        style={[
          styles.count,
          { color: secondaryColor },
        ]}
      >
        {isSearching
          ? `${items.length} ${
              items.length === 1 ? 'result' : 'results'
            } found`
          : `${items.length} saved ${
              items.length === 1 ? 'item' : 'items'
            }`}
      </Text>

      {items.map((item) => (
        <View
          key={item.id}
          style={[
            styles.card,
            { borderColor },
          ]}
        >
          {/* Tapping the card opens its content */}
          <Pressable
            style={styles.cardContent}
            onPress={() => {
              void handleCardPress(item);
            }}
            disabled={busyItemId !== null}
            accessibilityRole="button"
            accessibilityLabel={
              item.type === 'link'
                ? `Open ${item.title}`
                : item.type === 'image'
                  ? `View image ${item.title}`
                  : `Edit ${item.title}`
            }
          >
            <Text
              style={[
                styles.type,
                { color: secondaryColor },
              ]}
            >
              {item.type.toUpperCase()}
            </Text>

            <Text
              style={[
                styles.itemTitle,
                { color: textColor },
              ]}
            >
              {item.title}
            </Text>

            {/* Image preview */}
            {item.type === 'image' && item.image_uri && (
              <Image
                source={{ uri: item.image_uri }}
                style={styles.imagePreview}
                resizeMode="cover"
                accessibilityLabel={`Saved image: ${item.title}`}
              />
            )}

            {/* Note text, link URL, or image description */}
            {item.content ? (
              <Text
                style={[
                  styles.itemContent,
                  { color: secondaryColor },
                ]}
                numberOfLines={3}
              >
                {item.content}
              </Text>
            ) : null}

            {/* Tags */}
            {item.tags.length > 0 ? (
              <Text
                style={[
                  styles.tags,
                  { color: secondaryColor },
                ]}
              >
                {item.tags
                  .map((tag) => `#${tag}`)
                  .join('  ')}
              </Text>
            ) : null}
          </Pressable>

          {/* Three-dot menu now supports editing images */}
          <View style={styles.menuRow}>
            <ItemActionsMenu
              itemTitle={item.title}
              disabled={busyItemId !== null}
              actions={[
                {
                  label: 'Edit',
                  onPress: () => handleEdit(item),
                },
                {
                  label: 'Archive',
                  onPress: () => handleArchive(item),
                },
                {
                  label: 'Delete',
                  destructive: true,
                  onPress: () => handleMoveToTrash(item),
                },
              ]}
            />
          </View>
        </View>
      ))}

      {/* Image editor stays within the Library component,
          so Home and Search don't need changes. */}
      <EditImageModal
        image={editingImage}
        onClose={() => setEditingImage(null)}
        onSaved={handleImageSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statusText: {
    marginTop: 32,
  },

  messageContainer: {
    marginTop: 32,
    gap: 10,
  },

  list: {
    marginTop: 28,
    gap: 12,
  },

  count: {
    fontSize: 12,
    marginBottom: 4,
  },

  card: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    paddingRight: 56,
    gap: 12,
  },

  cardContent: {
    gap: 9,
  },

  type: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
  },

  itemContent: {
    fontSize: 14,
    lineHeight: 21,
  },

  imagePreview: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    backgroundColor: '#E6EBE5',
    marginTop: 4,
  },

  tags: {
    fontSize: 12,
    marginTop: 5,
  },

  menuRow: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 10,
    alignItems: 'flex-end',
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    marginTop: 28,
    gap: 10,
  },

  emptyDescription: {
    fontSize: 14,
    lineHeight: 21,
  },
});
