import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { SavedItem } from '@/database/items';

export type ReminderPayload = {
  kind: 'folio-item-reminder';
  itemId: number;
  userId: string;
};

export type ScheduledItemReminder = {
  identifier: string;
  scheduledFor: Date | null;
};

const REMINDER_KIND = 'folio-item-reminder';
const REMINDER_CHANNEL_ID = 'folio-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Default to tomorrow at 9 AM.
// Users can change both the date and time in the picker.
export function getDefaultReminderDate(
  now: Date = new Date()
): Date {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error(
      'Reminders are only available in the mobile app.'
    );
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      REMINDER_CHANNEL_ID,
      {
        name: 'Saved item reminders',
        description: 'Reminders to revisit saved Folio items.',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      }
    );
  }

  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    throw new Error(
      'Notification permission is disabled. Enable notifications for Folio in your phone settings.'
    );
  }
}

export function parseReminderPayload(
  data: Record<string, unknown> | undefined
): ReminderPayload | null {
  if (
    data?.kind !== REMINDER_KIND ||
    typeof data.userId !== 'string' ||
    !data.userId ||
    typeof data.itemId !== 'number' ||
    !Number.isSafeInteger(data.itemId) ||
    data.itemId <= 0
  ) {
    return null;
  }

  return {
    kind: REMINDER_KIND,
    itemId: data.itemId,
    userId: data.userId,
  };
}

// Find any pending reminder for this item and account.
export async function getItemReminder(
  itemId: number,
  userId: string
): Promise<ScheduledItemReminder | null> {
  const requests =
    await Notifications.getAllScheduledNotificationsAsync();

  for (const request of requests) {
    const payload = parseReminderPayload(
      request.content.data
    );

    if (
      payload?.itemId !== itemId ||
      payload.userId !== userId
    ) {
      continue;
    }

    const rawDate = request.content.data?.scheduledFor;

    const scheduledFor =
      typeof rawDate === 'string' &&
      Number.isFinite(Date.parse(rawDate))
        ? new Date(rawDate)
        : null;

    return {
      identifier: request.identifier,
      scheduledFor,
    };
  }

  return null;
}

// Cancel every pending reminder for the selected item.
// This is also called when an item is deleted.
export async function cancelRemindersForItem(
  itemId: number,
  userId: string
): Promise<void> {
  const requests =
    await Notifications.getAllScheduledNotificationsAsync();

  for (const request of requests) {
    const payload = parseReminderPayload(
      request.content.data
    );

    if (
      payload?.itemId === itemId &&
      payload.userId === userId
    ) {
      await Notifications.cancelScheduledNotificationAsync(
        request.identifier
      );
    }
  }
}

// Schedule for ANY chosen future date and time.
// If a previous reminder exists, replace it.
export async function scheduleItemReminderAt(
  item: SavedItem,
  userId: string,
  date: Date
): Promise<Date> {
  if (
    !Number.isSafeInteger(item.id) ||
    item.id <= 0 ||
    !userId
  ) {
    throw new Error(
      'Cannot schedule a reminder for this item.'
    );
  }

  if (item.deleted_at !== null) {
    throw new Error(
      'Deleted items cannot have new reminders.'
    );
  }

  if (
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime()) ||
    date.getTime() <= Date.now() + 5000
  ) {
    throw new Error(
      'Choose a future date and time for your reminder.'
    );
  }

  await ensureNotificationPermission();

  // Remember old IDs before creating the replacement.
  // This way a scheduling failure does not erase
  // an existing reminder.
  const requests =
    await Notifications.getAllScheduledNotificationsAsync();

  const previousIds = requests
    .filter((request) => {
      const payload = parseReminderPayload(
        request.content.data
      );

      return (
        payload?.itemId === item.id &&
        payload.userId === userId
      );
    })
    .map((request) => request.identifier);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'A little something from Folio',
      body: `Time to revisit "${item.title}".`,
      data: {
        kind: REMINDER_KIND,
        itemId: item.id,
        userId,
        scheduledFor: date.toISOString(),
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: REMINDER_CHANNEL_ID,
    },
  });

  // The new reminder exists, so old ones can be removed.
  for (const identifier of previousIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(
        identifier
      );
    } catch (error) {
      console.warn(
        'Could not remove a previous reminder:',
        error
      );
    }
  }

  return date;
}
