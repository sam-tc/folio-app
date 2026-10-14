import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';

import {
  getArchivedItems,
  restoreItem,
  type SavedItem,
} from '@/database/items';

export default function ArchiveScreen() {
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

  async function handleRestore(item: SavedItem) {
    if (busyItemId !== null) return;

    setBusyItemId(item.id);

    try {
      await restoreItem(db, item.id);

      // Remove the restored item from the Archive screen.
      setItems((currentItems) =>
        currentItems.filter(
          (savedItem) => savedItem.id !== item.id
        )
      );
    } catch (error) {
      Alert.alert(
        'Restore failed',
        error instanceof Error
          ? error.message
          : 'Could not restore this item.'
      );
    } finally {
      setBusyItemId(null);
    }
  }
  
  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.heading, { color: colors.text }]}>
        Archive
      </Text>

      <Text
        style={[styles.description, { color: colors.secondary }]}
      >
        Items you want to keep, but not see in your main library.
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.status} />
      ) : error ? (
        <Text style={[styles.status, { color: colors.text }]}>
          {error}
        </Text>
      ) : items.length === 0 ? (
        <View
          style={[
            styles.emptyState,
            { borderColor: colors.border },
          ]}
        >
          <Text style={[styles.itemTitle, { color: colors.text }]}>
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
              <Text style={[styles.type, { color: colors.secondary }]}>
                {item.type.toUpperCase()}
              </Text>

              <Text style={[styles.itemTitle, { color: colors.text }]}>
                {item.title}
              </Text>

              <Text style={{ color: colors.secondary }}>
                {item.content}
              </Text>

              {item.tags.length > 0 && (
                <Text style={{ color: colors.secondary }}>
                  {item.tags.map((tag) => `#${tag}`).join('  ')}
                </Text>
              )}
              <Pressable
                style={styles.restoreButton}
                onPress={() => {
                  void handleRestore(item);
                }}
                disabled={busyItemId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Restore ${item.title}`}
              >
                <Text style={styles.restoreText}>
                  {busyItemId === item.id ? 'Restoring...' : 'Restore'}
                </Text>
              </Pressable>
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
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
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
  restoreButton: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    marginTop: 8,
  },

  restoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A66A35',
  },  
});
