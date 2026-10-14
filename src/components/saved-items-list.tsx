import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
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
  onSelectNote: (note: SavedItem) => void;
};

export default function SavedItemsList({
  refreshKey,
  onSelectNote,
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

  // Reload Library whenever the screen gains focus
  // or an item is created, edited, archived, or deleted.
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

  // Tap a note to edit it.
  // Tap a link to open its website.
  async function handleCardPress(item: SavedItem) {
    if (item.type === 'note') {
      onSelectNote(item);
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

  // Save the archived status to SQLite.
  async function confirmArchive(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await archiveItem(db, item.id);

      // Reload the Library after archiving.
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

  // Ask the user before archiving an item.
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

  // Soft-delete the selected item.
  async function moveItemToTrash(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await moveToRecentlyDeleted(db, item.id);

      // Remove the deleted item from Library.
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

  // Confirm before moving an item to Recently Deleted.
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

  // Loading state.
  if (loading) {
    return (
      <Text style={{ color: secondaryColor }}>
        Loading library...
      </Text>
    );
  }

  // Error state.
  if (error) {
    return (
      <Text style={{ color: textColor }}>
        Error: {error}
      </Text>
    );
  }

  // Empty Library state.
  if (items.length === 0) {
    return (
      <View style={[styles.emptyState, { borderColor }]}>
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

  // Display notes and links saved in SQLite.
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.list}
    >
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
            disabled={
              item.type === 'image' || busyItemId !== null
            }
            accessibilityRole="button"
            accessibilityLabel={
              item.type === 'link'
                ? `Open ${item.title}`
                : `Edit ${item.title}`
            }
          >
            {/* Item type */}
            <Text
              style={[
                styles.type,
                { color: secondaryColor },
              ]}
            >
              {item.type.toUpperCase()}
            </Text>

            {/* Item title */}
            <Text
              style={[
                styles.itemTitle,
                { color: textColor },
              ]}
            >
              {item.title}
            </Text>

            {/* Note content or website URL */}
            {item.content ? (
              <Text
                style={{
                  color: secondaryColor,
                  lineHeight: 21,
                }}
                numberOfLines={3}
              >
                {item.content}
              </Text>
            ) : null}

            {/* Item tags */}
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

          {/* Floating three-dot menu */}
          <View style={styles.menuRow}>
            <ItemActionsMenu
              itemTitle={item.title}
              disabled={busyItemId !== null}
              actions={[
                {
                  label: 'Edit',
                  onPress: () => onSelectNote(item),
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginTop: 24,
  },

  list: {
    paddingBottom: 120,
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
