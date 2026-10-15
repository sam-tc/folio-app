import { useFolioColorScheme as useColorScheme } from '@/components/appearance-provider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  AppState,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { useAuth } from '@/components/auth-provider';
import { ItemActionsMenu } from '@/components/item-actions-menu';
import EditImageModal from '@/components/edit-image-modal';

import {
  archiveItem,
  moveToRecentlyDeleted,
  type SavedItem,
} from '@/database/items';
import {
  searchLibraryItems,
  type LibraryFilter,
} from '@/database/search';

import { synchronizeLibrary } from '@/lib/library-sync';

type Props = {
  refreshKey: number;
  searchQuery: string;
  filter: LibraryFilter;
  onSelectNote: (item: SavedItem) => void;
  onSelectImage: (item: SavedItem) => void;
};

const MAX_VISIBLE_TAGS = 3;

function formatSavedDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
}

export default function SavedItemsList({
  refreshKey,
  searchQuery,
  filter,
  onSelectNote,
  onSelectImage,
}: Props) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const userId = user?.id;

  const isDark = useColorScheme() === 'dark';

  const [items, setItems] = useState<SavedItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localRefreshKey, setLocalRefreshKey] =
    useState(0);

  const [busyItemId, setBusyItemId] =
    useState<number | null>(null);

  const [editingImage, setEditingImage] =
    useState<SavedItem | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] =
    useState<string | null>(null);

  const syncRunningRef = useRef(false);
  const syncAgainRef = useRef(false);
  const focusedRef = useRef(false);

  const colors = {
    text: isDark ? '#F7F4EE' : '#243126',
    secondary: isDark ? '#B4C0B5' : '#627266',
    subtle: isDark ? '#8B9B8D' : '#768679',
    card: isDark ? '#202821' : '#FFFDF8',
    border: isDark ? '#39483D' : '#DBE3D9',
    accent: isDark ? '#D6B990' : '#45664D',
    tagBackground: isDark ? '#2D3A30' : '#EDF2EA',
    tagText: isDark ? '#D0DBCF' : '#49634F',
    imageBackground: isDark ? '#303A32' : '#E8EDE6',
    error: isDark ? '#FFAAA3' : '#A43E38',
  };

  const hasActiveSearch =
    searchQuery.trim().length > 0;

  const hasActiveFilter = filter !== 'all';

  const isSearching =
    hasActiveSearch || hasActiveFilter;

  // Always display locally saved items, even offline.
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
                : 'Failed to load your library.'
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

  /*
   * Synchronize in the background.
   *
   * If another request arrives while syncing,
   * remember it and run again afterward.
   *
   * This prevents a local edit from being missed
   * just because another sync was already running.
   */
  const runSynchronization = useCallback(
    async () => {
      if (!userId) {
        return;
      }

      if (syncRunningRef.current) {
        syncAgainRef.current = true;
        return;
      }

      syncRunningRef.current = true;
      setIsSyncing(true);
      setSyncError(null);

      try {
        do {
          syncAgainRef.current = false;

          console.log(
            'FOLIO LIBRARY SYNC: STARTING'
          );

          const result = await synchronizeLibrary(
            db,
            userId
          );

          console.log(
            'FOLIO LIBRARY SYNC: COMPLETE',
            JSON.stringify(result)
          );

          // Update the screen with downloaded items.
          setLocalRefreshKey(
            (current) => current + 1
          );
        } while (syncAgainRef.current);

        setSyncError(null);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not synchronize your library.';

        console.warn(
          'FOLIO LIBRARY SYNC: FAILED',
          message
        );

        // Network failure never hides local items.
        setSyncError(message);
      } finally {
        syncRunningRef.current = false;
        setIsSyncing(false);
      }
    },
    [db, userId]
  );

  // Synchronize when the Library becomes active.
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;

      void runSynchronization();

      return () => {
        focusedRef.current = false;
      };
    }, [runSynchronization])
  );

  // Synchronize when Folio returns from the background.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (
          nextState === 'active' &&
          focusedRef.current
        ) {
          void runSynchronization();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [runSynchronization]);

  // Synchronize after creating or editing items.
  useEffect(() => {
    if (
      refreshKey > 0 &&
      focusedRef.current
    ) {
      void runSynchronization();
    }
  }, [refreshKey, runSynchronization]);

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

  function handleEdit(item: SavedItem) {
    if (item.type === 'image') {
      setEditingImage(item);
    } else {
      onSelectNote(item);
    }
  }

  function handleImageSaved() {
    setLocalRefreshKey(
      (current) => current + 1
    );
  }

  async function confirmArchive(item: SavedItem) {
    if (busyItemId !== null) {
      return;
    }

    setBusyItemId(item.id);

    try {
      await archiveItem(db, item.id);

      setLocalRefreshKey(
        (current) => current + 1
      );

      if (item.type !== 'image') {
        void runSynchronization();
      }
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
    if (busyItemId !== null) {
      return;
    }

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
    if (busyItemId !== null) {
      return;
    }

    setBusyItemId(item.id);

    try {
      await moveToRecentlyDeleted(db, item.id);

      setLocalRefreshKey(
        (current) => current + 1
      );

      if (item.type !== 'image') {
        void runSynchronization();
      }
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
    if (busyItemId !== null) {
      return;
    }

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

  return (
    <View>
      {/* No permanent sync panel or button. */}
      {isSyncing ? (
        <Text
          style={[
            styles.syncHint,
            { color: colors.subtle },
          ]}
          accessibilityRole="text"
        >
          Syncing…
        </Text>
      ) : null}

      {/* Retry appears only if synchronization fails. */}
      {!isSyncing && syncError ? (
        <View style={styles.syncErrorRow}>
          <View style={styles.syncErrorCopy}>
            <Text
              style={[
                styles.syncErrorTitle,
                { color: colors.error },
              ]}
            >
              Could not sync
            </Text>

            <Text
              style={[
                styles.syncErrorDescription,
                { color: colors.secondary },
              ]}
            >
              Your saved items are still available
              on this device.
            </Text>
          </View>

          <Pressable
            style={styles.retryAction}
            onPress={() => {
              void runSynchronization();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry cloud synchronization"
          >
            <Text
              style={[
                styles.retryText,
                { color: colors.accent },
              ]}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!hasLoaded ? (
        <Text
          style={[
            styles.statusText,
            { color: colors.secondary },
          ]}
        >
          Loading library...
        </Text>
      ) : error ? (
        <View style={styles.messageContainer}>
          <Text
            style={[
              styles.itemTitle,
              { color: colors.text },
            ]}
          >
            Couldn't load your library
          </Text>

          <Text
            style={[
              styles.emptyDescription,
              { color: colors.secondary },
            ]}
          >
            {error}
          </Text>
        </View>
      ) : items.length === 0 ? (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.emptyEyebrow,
              { color: colors.accent },
            ]}
          >
            {isSearching
              ? 'NO RESULTS'
              : 'A FRESH PAGE'}
          </Text>

          <Text
            style={[
              styles.itemTitle,
              { color: colors.text },
            ]}
          >
            {isSearching
              ? 'Nothing found just yet'
              : 'Your library starts here'}
          </Text>

          <Text
            style={[
              styles.emptyDescription,
              { color: colors.secondary },
            ]}
          >
            {isSearching
              ? 'Try another word or change the selected filter.'
              : 'Save a note, link, or image and it will appear here.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          <Text
            style={[
              styles.count,
              { color: colors.secondary },
            ]}
          >
            {isSearching
              ? `${items.length} ${
                  items.length === 1
                    ? 'result'
                    : 'results'
                }`
              : `${items.length} saved ${
                  items.length === 1
                    ? 'item'
                    : 'items'
                }`}
          </Text>

          {items.map((item) => {
            const dateLabel = formatSavedDate(
              item.updated_at
            );

            const visibleTags = item.tags.slice(
              0,
              MAX_VISIBLE_TAGS
            );

            const hiddenTags =
              item.tags.length - visibleTags.length;

            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.typeDot,
                        {
                          backgroundColor:
                            colors.accent,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.type,
                        { color: colors.accent },
                      ]}
                    >
                      {item.type.toUpperCase()}
                    </Text>

                    {dateLabel ? (
                      <Text
                        style={[
                          styles.date,
                          { color: colors.subtle },
                        ]}
                      >
                        · {dateLabel}
                      </Text>
                    ) : null}
                  </View>

                  <ItemActionsMenu
                    itemTitle={item.title}
                    disabled={busyItemId !== null}
                    actions={[
                      {
                        label: 'Edit',
                        onPress: () =>
                          handleEdit(item),
                      },
                      {
                        label: 'Archive',
                        onPress: () =>
                          handleArchive(item),
                      },
                      {
                        label: 'Delete',
                        destructive: true,
                        onPress: () =>
                          handleMoveToTrash(item),
                      },
                    ]}
                  />
                </View>

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
                        : `View note ${item.title}`
                  }
                >
                  <Text
                    style={[
                      styles.itemTitle,
                      { color: colors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  {item.type === 'image' &&
                  item.image_uri ? (
                    <Image
                      source={{
                        uri: item.image_uri,
                      }}
                      style={[
                        styles.imagePreview,
                        {
                          backgroundColor:
                            colors.imageBackground,
                        },
                      ]}
                      resizeMode="cover"
                      accessibilityLabel={
                        `Saved image: ${item.title}`
                      }
                    />
                  ) : null}

                  {item.content ? (
                    <Text
                      style={[
                        styles.itemContent,
                        {
                          color: colors.secondary,
                        },
                        item.type === 'link' && {
                          color: colors.accent,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {item.content}
                    </Text>
                  ) : null}

                  {item.tags.length > 0 ? (
                    <View style={styles.tagRow}>
                      {visibleTags.map(
                        (tag, index) => (
                          <View
                            key={`${tag}-${index}`}
                            style={[
                              styles.tag,
                              {
                                backgroundColor:
                                  colors.tagBackground,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.tagText,
                                {
                                  color:
                                    colors.tagText,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              #{tag}
                            </Text>
                          </View>
                        )
                      )}

                      {hiddenTags > 0 ? (
                        <Text
                          style={[
                            styles.moreTags,
                            { color: colors.subtle },
                          ]}
                        >
                          +{hiddenTags}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

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
    marginTop: 24,
    fontSize: 14,
  },

  messageContainer: {
    marginTop: 24,
    gap: 10,
  },

  syncHint: {
    marginTop: 12,
    marginBottom: 2,
    fontSize: 11,
    fontWeight: '500',
  },

  syncErrorRow: {
    marginTop: 12,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  syncErrorCopy: {
    flex: 1,
    gap: 3,
  },

  syncErrorTitle: {
    fontSize: 12,
    fontWeight: '600',
  },

  syncErrorDescription: {
    fontSize: 11,
    lineHeight: 16,
  },

  retryAction: {
    minHeight: 44,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    fontSize: 12,
    fontWeight: '700',
  },

  list: {
    marginTop: 19,
    gap: 10,
  },

  count: {
    fontSize: 12,
    letterSpacing: 0.1,
    marginBottom: 4,
  },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingTop: 9,
    paddingBottom: 18,
  },

  cardHeader: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 7,
  },

  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  type: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
  },

  date: {
    fontSize: 11,
    fontWeight: '400',
  },

  cardContent: {
    gap: 8,
  },

  itemTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },

  itemContent: {
    fontSize: 13,
    lineHeight: 19,
  },

  imagePreview: {
    width: '100%',
    height: 165,
    borderRadius: 12,
    marginVertical: 4,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },

  tag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: '72%',
  },

  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },

  moreTags: {
    fontSize: 11,
    marginLeft: 2,
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    marginTop: 16,
    gap: 10,
  },

  emptyEyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '700',
  },

  emptyDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
});
