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
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ItemActionsMenu } from '@/components/item-actions-menu';

import {
  getRecentlyDeletedItems,
  permanentlyDeleteItem,
  purgeExpiredDeletedItems,
  restoreDeletedItem,
  type SavedItem,
} from '@/database/items';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECOVERY_DAYS = 30;

// Calculate how many days remain before permanent deletion.
function getDaysRemaining(deletedAt: string | null): number {
  if (!deletedAt) return 0;

  const expiryTime =
    new Date(deletedAt).getTime() + RECOVERY_DAYS * DAY_MS;

  return Math.max(
    0,
    Math.ceil((expiryTime - Date.now()) / DAY_MS)
  );
}

export default function RecentlyDeletedScreen() {
  const db = useSQLiteContext();
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

  // Reload deleted items whenever this screen receives focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadDeletedItems() {
        setLoading(true);

        try {
          // Remove items that have passed their recovery period.
          await purgeExpiredDeletedItems(db);

          // Fetch the remaining deleted items.
          const deletedItems = await getRecentlyDeletedItems(db);

          if (active) {
            setItems(deletedItems);
            setError(null);
          }
        } catch (err) {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : 'Could not load recently deleted items.'
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadDeletedItems();

      return () => {
        active = false;
      };
    }, [db])
  );

  // Restore an item to its original Library or Archive location.
  async function handleRestore(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await restoreDeletedItem(db, item.id);

      // Remove the restored item from the deleted-items list.
      setItems((currentItems) =>
        currentItems.filter(
          (currentItem) => currentItem.id !== item.id
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

  // Permanently remove an item from SQLite.
  async function handlePermanentDelete(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await permanentlyDeleteItem(db, item.id);

      // Remove the deleted item from the current list.
      setItems((currentItems) =>
        currentItems.filter(
          (currentItem) => currentItem.id !== item.id
        )
      );
    } catch (err) {
      Alert.alert(
        'Deletion failed',
        err instanceof Error
          ? err.message
          : 'Could not permanently delete this item.'
      );
    } finally {
      setBusyItemId(null);
    }
  }

  // Ask for confirmation before permanent deletion.
  function confirmPermanentDelete(item: SavedItem) {
    if (busyItemId !== null) return;

    Alert.alert(
      'Permanently delete this item?',
      'This item will be deleted permanently and cannot be recovered.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            void handlePermanentDelete(item);
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
        Recently Deleted
      </Text>

      <Text
        style={[
          styles.description,
          { color: colors.secondary },
        ]}
      >
        Items can be recovered for up to 30 days before they
        are permanently deleted.
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
            Nothing here yet
          </Text>

          <Text style={{ color: colors.secondary }}>
            Deleted items will appear here for up to 30 days.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {items.map((item) => {
            const daysLeft = getDaysRemaining(item.deleted_at);

            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  { borderColor: colors.border },
                ]}
              >
                {/* Three-dot menu at the top-right */}
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
                        label: 'Delete Permanently',
                        destructive: true,
                        onPress: () => {
                          confirmPermanentDelete(item);
                        },
                      },
                    ]}
                  />
                </View>

                {/* Item type */}
                <Text
                  style={[
                    styles.type,
                    { color: colors.secondary },
                  ]}
                >
                  {item.type.toUpperCase()}
                </Text>

                {/* Item title */}
                <Text
                  style={[
                    styles.itemTitle,
                    { color: colors.text },
                  ]}
                >
                  {item.title}
                </Text>

                {/* Item content */}
                {item.content.length > 0 && (
                  <Text
                    style={{ color: colors.secondary }}
                    numberOfLines={2}
                  >
                    {item.content}
                  </Text>
                )}

                {/* Remaining recovery period */}
                <Text style={styles.expiry}>
                  {daysLeft}{' '}
                  {daysLeft === 1 ? 'day' : 'days'} left
                </Text>

                {/* Original location */}
                <Text
                  style={[
                    styles.destination,
                    { color: colors.secondary },
                  ]}
                >
                  Restores to{' '}
                  {item.is_archived ? 'Archive' : 'Library'}
                </Text>
              </View>
            );
          })}
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

  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
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

  expiry: {
    color: '#B46D38',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  destination: {
    fontSize: 12,
  },
});
