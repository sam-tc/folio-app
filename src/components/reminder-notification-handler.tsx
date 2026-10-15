import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Alert, Linking } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { useAuth } from '@/components/auth-provider';
import EditNoteModal from '@/components/edit-note-modal';
import ImageViewerModal from '@/components/image-viewer-modal';
import {
  getArchivedItems,
  getInboxItems,
  type SavedItem,
} from '@/database/items';
import { parseReminderPayload } from '@/lib/reminders';

type Props = {
  onSaved: () => void;
};

export default function ReminderNotificationHandler({
  onSaved,
}: Props) {
  const db = useSQLiteContext();
  const { user } = useAuth();

  const [selectedNote, setSelectedNote] =
    useState<SavedItem | null>(null);
  const [selectedImage, setSelectedImage] =
    useState<SavedItem | null>(null);

  const handledNotifications = useRef(
    new Set<string>()
  );

  const handleResponse = useCallback(
    async (
      response: Notifications.NotificationResponse
    ) => {
      if (
        response.actionIdentifier !==
        Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        return;
      }

      const payload = parseReminderPayload(
        response.notification.request.content.data
      );

      if (!payload) {
        return;
      }

      const notificationId =
        response.notification.request.identifier;

      // Prevent duplicate handling on app startup.
      if (
        handledNotifications.current.has(notificationId)
      ) {
        return;
      }

      handledNotifications.current.add(notificationId);

      // Do not reopen an old reminder on later launches.
      try {
        await Notifications.clearLastNotificationResponseAsync();
      } catch (error) {
        console.warn(
          'Could not clear notification response:',
          error
        );
      }

      // Every account has its own local SQLite database.
      if (!user || payload.userId !== user.id) {
        Alert.alert(
          'Different account',
          'This reminder belongs to another Folio account.'
        );
        return;
      }

      try {
        const [libraryItems, archivedItems] =
          await Promise.all([
            getInboxItems(db),
            getArchivedItems(db),
          ]);

        const item = [
          ...libraryItems,
          ...archivedItems,
        ].find(
          (savedItem) =>
            savedItem.id === payload.itemId
        );

        // Deleted or permanently removed items are excluded
        // by both database queries.
        if (!item) {
          Alert.alert(
            'Item unavailable',
            'This saved item may have been deleted or is no longer available on this device.'
          );
          return;
        }

        if (item.is_archived) {
          Alert.alert(
            'Item is archived',
            'Restore this item from Archive to open it in your Library.'
          );
          return;
        }

        if (item.type === 'note') {
          setSelectedNote(item);
          return;
        }

        if (item.type === 'image') {
          setSelectedImage(item);
          return;
        }

        if (item.type === 'link') {
          await Linking.openURL(item.content);
        }
      } catch (error) {
        Alert.alert(
          'Could not open reminder',
          error instanceof Error
            ? error.message
            : 'Please try opening the item from your Library.'
        );
      }
    },
    [db, user]
  );

  useEffect(() => {
    let active = true;

    // Handles notification taps while Folio is running.
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          void handleResponse(response);
        }
      );

    // Handles launching Folio by tapping a notification.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active && response) {
          void handleResponse(response);
        }
      })
      .catch((error) => {
        console.warn(
          'Could not read last notification:',
          error
        );
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleResponse]);

  return (
    <>
      <EditNoteModal
        visible={selectedNote !== null}
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onSaved={onSaved}
      />

      <ImageViewerModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </>
  );
}
