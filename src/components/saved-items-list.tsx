
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { getInboxItems, type SavedItem } from '@/database/items';

type Props = {
  refreshKey: number;
};

export default function SavedItemsList({ refreshKey }: Props) {
  const db = useSQLiteContext();
  const isDark = useColorScheme() === 'dark';

  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const textColor = isDark ? '#F5F5F0' : '#202020';
  const secondaryColor = isDark ? '#B8B8B0' : '#606060';
  const borderColor = isDark ? '#464C46' : '#D8D8D0';

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setLoading(true);

      try {
        const savedItems = await getInboxItems(db);

        if (!cancelled) {
          setItems(savedItems);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load items.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [db, refreshKey]);

  if (loading) {
    return <Text style={{ color: secondaryColor }}>Loading library...</Text>;
  }

  if (error) {
    return <Text style={{ color: textColor }}>Error: {error}</Text>;
  }

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
          <Text style={[styles.type, { color: secondaryColor }]}>
            {item.type.toUpperCase()}
          </Text>

          <Text style={[styles.itemTitle, { color: textColor }]}>
            {item.title}
          </Text>

          {item.content ? (
            <Text
              style={{ color: secondaryColor, lineHeight: 21 }}
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
  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    marginTop: 32,
    gap: 10,
  },
});
