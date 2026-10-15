import { useFolioColorScheme as useColorScheme } from '@/components/appearance-provider';

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '@/components/auth-provider';
import { cancelRemindersForItem } from '@/lib/reminders';
import { useFocusEffect } from 'expo-router';

import { ItemActionsMenu } from '@/components/item-actions-menu';

import {
  getArchivedItems,
  moveToRecentlyDeleted,
  restoreItem,
  type SavedItem,
} from '@/database/items';

export default function ArchiveScreen() {
  const db = useSQLiteContext();
  const userId = useAuth().user?.id;
  const isDark = useColorScheme() === 'dark';

  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  const colors = {
    background: isDark ? '#171B18' : '#F7F4ED',
    text: isDark ? '#F7F4EE' : '#222A22',
    secondary: isDark ? '#C3CBC1' : '#526457',
    border: isDark ? '#425849' : '#C8D3C6',
  };

  // Load archived items whenever this screen gets focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadArchive() {
        setLoading(true);

        try {
          const archivedItems = await getArchivedItems(db);

          if (active) {
            setItems(archivedItems);
            setError(null);
          }
        } catch (err) {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : 'Could not load archived items.'
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadArchive();

      return () => {
        active = false;
      };
    }, [db])
  );

  // Restore an archived item to the Home library.
  async function handleRestore(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await restoreItem(db, item.id);

      setItems((currentItems) =>
        currentItems.filter(
          (savedItem) => savedItem.id !== item.id
        )
      );
    } catch (err) {
      Alert.alert(
        'Restore failed',
        err instanceof Error
          ? err.message
          : 'Could not restore this item.'
      );
    } finally {
      setBusyItemId(null);
    }
  }

  // Move an archived item to Recently Deleted.
  async function moveArchivedItemToTrash(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await moveToRecentlyDeleted(db, item.id);

      if (userId) {
        try {
          await cancelRemindersForItem(item.id, userId);
        } catch (error) {
          console.warn(
            'Could not cancel reminder for deleted item:',
            error
          );
        }
      }

      // Remove it from the visible Archive list.
      setItems((currentItems) =>
        currentItems.filter(
          (savedItem) => savedItem.id !== item.id
        )
      );
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

  // Ask for confirmation before moving an item to trash.
  function confirmMoveToTrash(item: SavedItem) {
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
            void moveArchivedItemToTrash(item);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Text
        style={[
          styles.heading,
          { color: colors.text },
        ]}
      >
        Archive
      </Text>

      <Text
        style={[
          styles.description,
          { color: colors.secondary },
        ]}
      >
        Items you want to keep, but not see in your main library.
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.status} />
      ) : error ? (
        <Text
          style={[
            styles.status,
            { color: colors.text },
          ]}
        >
          {error}
        </Text>
      ) : items.length === 0 ? (
        <View
          style={[
            styles.emptyState,
            { borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.itemTitle,
              { color: colors.text },
            ]}
          >
            Nothing archived yet
          </Text>

          <Text style={{ color: colors.secondary }}>
            Items you archive will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {items.map((item) => (
            <View
              key={item.id}
              style={[
                styles.card,
                { borderColor: colors.border },
              ]}
            >
              {/* Compact menu at the top-right */}
              <View style={styles.menuRow}>
                <ItemActionsMenu
                  itemTitle={item.title}
                  disabled={busyItemId !== null}
                  actions={[
                    {
                      label: 'Restore',
                      onPress: () => {
                        void handleRestore(item);
                      },
                    },
                    {
                      label: 'Delete',
                      destructive: true,
                      onPress: () => {
                        confirmMoveToTrash(item);
                      },
                    },
                  ]}
                />
              </View>

              <Text
                style={[
                  styles.type,
                  { color: colors.secondary },
                ]}
              >
                {item.type.toUpperCase()}
              </Text>

              <Text
                style={[
                  styles.itemTitle,
                  { color: colors.text },
                ]}
              >
                {item.title}
              </Text>

              {item.content.length > 0 && (
                <Text style={{ color: colors.secondary }}>
                  {item.content}
                </Text>
              )}

              {item.tags.length > 0 && (
                <Text style={{ color: colors.secondary }}>
                  {item.tags
                    .map((tag) => `#${tag}`)
                    .join('  ')}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 28,
  },

  heading: {
    fontSize: 36,
    fontWeight: '600',
    letterSpacing: -1.5,
  },

  description: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },

  status: {
    marginTop: 40,
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    marginTop: 36,
    gap: 10,
  },

  list: {
    flex: 1,
    marginTop: 28,
  },

  listContent: {
    paddingBottom: 120,
    gap: 12,
  },

  card: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    paddingRight: 56,
    gap: 9,
  },

  menuRow: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 10,
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
});
