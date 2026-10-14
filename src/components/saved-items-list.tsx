
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
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
  type SavedItem,
} from '@/database/items';

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

  // State for saved items, loading and errors
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for refreshing and archive operations
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  const textColor = isDark ? '#F5F5F0' : '#202020';
  const secondaryColor = isDark ? '#B8B8B0' : '#606060';
  const borderColor = isDark ? '#464C46' : '#D8D8D0';

  // Reload saved items whenever the Library screen gains focus
  // or a refresh key changes.
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

  // Archive a saved item in SQLite
  async function confirmArchive(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await archiveItem(db, item.id);

      // Refresh Library after successfully archiving
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

  // Ask for confirmation before archiving
  function handleArchive(item: SavedItem) {
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

  // Loading state
  if (loading) {
    return (
      <Text style={{ color: secondaryColor }}>
        Loading library...
      </Text>
    );
  }

  // Error state
  if (error) {
    return (
      <Text style={{ color: textColor }}>
        Error: {error}
      </Text>
    );
  }

  // Empty Library state
  if (items.length === 0) {
    return (
      <View style={[styles.emptyState, { borderColor }]}>
        <Text style={[styles.itemTitle, { color: textColor }]}>
          Your library starts here
        </Text>

        <Text style={{ color: secondaryColor }}>
          Nothing saved yet. Your collection will appear here.
        </Text>
      </View>
    );
  }

  // Display saved items
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.list}
    >
      <Text style={[styles.count, { color: secondaryColor }]}>
        {items.length} saved {items.length === 1 ? 'item' : 'items'}
      </Text>

      {items.map((item) => (
        <View
          key={item.id}
          style={[styles.card, { borderColor }]}
        >
          {/* Tap a note to edit it */}
          <Pressable
            style={styles.cardContent}
            onPress={() => onSelectNote(item)}
            disabled={item.type !== 'note' || busyItemId !== null}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.title}`}
          >
            <Text style={[styles.type, { color: secondaryColor }]}>
              {item.type.toUpperCase()}
            </Text>

            <Text style={[styles.itemTitle, { color: textColor }]}>
              {item.title}
            </Text>

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

            {item.tags.length > 0 ? (
              <Text style={[styles.tags, { color: secondaryColor }]}>
                {item.tags.map((tag) => `#${tag}`).join('  ')}
              </Text>
            ) : null}
          </Pressable>

          {/* Archive action */}
          <View
            style={[
              styles.actions,
              { borderTopColor: borderColor },
            ]}
          >
            <Pressable
              onPress={() => handleArchive(item)}
              disabled={busyItemId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Archive ${item.title}`}
              hitSlop={8}
            >
              <Text style={styles.archiveText}>
                {busyItemId === item.id
                  ? 'Archiving...'
                  : 'Archive'}
              </Text>
            </Pressable>
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
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
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

  actions: {
    borderTopWidth: 1,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  archiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A66A35',
    paddingVertical: 6,
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    marginTop: 32,
    gap: 10,
  },
});
