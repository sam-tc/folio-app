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
  getInboxItems,
  moveToRecentlyDeleted,
  type SavedItem,
} from '@/database/items';

import { ItemActionsMenu } from '@/components/item-actions-menu';

type Props = {
  refreshKey: number;
  onSelectNote: (item: SavedItem) => void;
  onSelectImage: (item: SavedItem) => void;
};

export default function SavedItemsList({
  refreshKey,
  onSelectNote,
  onSelectImage,
}: Props) {
  const db = useSQLiteContext();
  const isDark = useColorScheme() === 'dark';

  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  const textColor = isDark ? '#F5F5F0' : '#202020';
  const secondaryColor = isDark ? '#B8B8B0' : '#606060';
  const borderColor = isDark ? '#464C46' : '#D8D8D0';

  // Refresh Library when screen gains focus or items change.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadItems() {
        setLoading(true);

        try {
          const savedItems = await getInboxItems(db);

          if (active) {
            setItems(savedItems);
            setError(null);
          }
        } catch (err) {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : 'Failed to load items.'
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadItems();

      return () => {
        active = false;
      };
    }, [db, refreshKey, localRefreshKey])
  );

  // Decide what happens when each item card is tapped.
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

  // Move an item from Library to Archive.
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

  // Ask for confirmation before archiving.
  function handleArchive(item: SavedItem) {
    if (busyItemId !== null) return;

    Alert.alert(
      'Archive this item?',
      `"${item.title}" will move to your Archive. You can restore it later.`,
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

  // Move an item to Recently Deleted.
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

  // Ask for confirmation before moving to Recently Deleted.
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

  if (loading) {
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
      <Text
        style={[
          styles.statusText,
          { color: textColor },
        ]}
      >
        Error: {error}
      </Text>
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
          Your library starts here
        </Text>

        <Text style={{ color: secondaryColor }}>
          Nothing saved yet. Your collection will appear here.
        </Text>
      </View>
    );
  }

  // The parent Home ScrollView handles all scrolling.
  return (
    <View style={styles.list}>
      <Text
        style={[
          styles.count,
          { color: secondaryColor },
        ]}
      >
        {items.length} saved {items.length === 1 ? 'item' : 'items'}
      </Text>

      {items.map((item) => (
        <View
          key={item.id}
          style={[
            styles.card,
            { borderColor },
          ]}
        >
          {/* Main card content */}
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

            {/* Saved image preview */}
            {item.type === 'image' && item.image_uri && (
              <Image
                source={{ uri: item.image_uri }}
                style={styles.imagePreview}
                resizeMode="cover"
                accessibilityLabel={`Saved image: ${item.title}`}
              />
            )}

            {/* Note, link or image description */}
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

          {/* Three-dot menu */}
          <View style={styles.menuRow}>
            <ItemActionsMenu
              itemTitle={item.title}
              disabled={busyItemId !== null}
              actions={[
                ...(item.type === 'note' || item.type === 'link'
                  ? [
                      {
                        label: 'Edit',
                        onPress: () => onSelectNote(item),
                      },
                    ]
                  : []),
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
    </View>
  );
}

const styles = StyleSheet.create({
  statusText: {
    marginTop: 32,
  },

  list: {
    marginTop: 32,
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
    marginTop: 32,
    gap: 10,
  },
});
