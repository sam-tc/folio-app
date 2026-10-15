import { useEffect, useMemo, useState } from 'react';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFolioColorScheme } from '@/components/appearance-provider';
import type { SavedItem } from '@/database/items';
import {
  cancelRemindersForItem,
  getItemReminder,
  getDefaultReminderDate,
  scheduleItemReminderAt,
  type ScheduledItemReminder,
} from '@/lib/reminders';

type Props = {
  visible: boolean;
  item: SavedItem | null;
  userId: string | undefined;
  onClose: () => void;
};

type PickerMode = 'date' | 'time';

const palettes = {
  light: {
    background: '#F7F4ED',
    card: '#FFFEFA',
    muted: '#EDF2EA',
    border: '#D8E0D5',
    text: '#222A22',
    secondary: '#627266',
    accent: '#315C46',
    buttonText: '#FFFFFF',
    danger: '#AD4943',
  },
  dark: {
    background: '#171B18',
    card: '#252D27',
    muted: '#303D33',
    border: '#45574B',
    text: '#F7F4EE',
    secondary: '#C3CBC1',
    accent: '#A9CFB1',
    buttonText: '#171B18',
    danger: '#FFAAA3',
  },
};

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function mergePickerValue(
  previous: Date,
  picked: Date,
  mode: PickerMode
): Date {
  const next = new Date(previous);

  if (mode === 'date') {
    next.setFullYear(
      picked.getFullYear(),
      picked.getMonth(),
      picked.getDate()
    );
  } else {
    next.setHours(
      picked.getHours(),
      picked.getMinutes(),
      0,
      0
    );
  }

  return next;
}

export default function ReminderPickerModal({
  visible,
  item,
  userId,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDark = useFolioColorScheme() === 'dark';

  const colors = palettes[isDark ? 'dark' : 'light'];
  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const [selectedDate, setSelectedDate] = useState(
    () => getDefaultReminderDate()
  );
  const [pickerMode, setPickerMode] =
    useState<PickerMode>('time');

  const [androidPickerMode, setAndroidPickerMode] =
    useState<PickerMode | null>(null);

  const [existing, setExisting] =
    useState<ScheduledItemReminder | null>(null);

  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!visible || !item || !userId) {
      return;
    }

    let active = true;

    setLoading(true);
    setExisting(null);
    setPickerMode('time');
    setSelectedDate(getDefaultReminderDate());

    void getItemReminder(item.id, userId)
      .then((reminder) => {
        if (!active) return;

        setExisting(reminder);

        if (reminder?.scheduledFor) {
          setSelectedDate(reminder.scheduledFor);
        }
      })
      .catch((error) => {
        if (!active) return;

        Alert.alert(
          'Could not load reminder',
          error instanceof Error
            ? error.message
            : 'Please try again.'
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [visible, item?.id, userId]);

  function handlePickerChange(
    event: DateTimePickerEvent,
    picked?: Date
  ) {
    if (Platform.OS === 'android') {
      setAndroidPickerMode(null);
    }

    if (event.type === 'dismissed' || !picked) {
      return;
    }

    const mode =
      Platform.OS === 'android'
        ? androidPickerMode ?? 'time'
        : pickerMode;

    setSelectedDate((previous) =>
      mergePickerValue(previous, picked, mode)
    );
  }

  function handleClose() {
    if (working) return;

    setAndroidPickerMode(null);
    onClose();
  }

  async function handleSchedule() {
    if (!item || !userId || working || loading) {
      return;
    }

    if (selectedDate.getTime() <= Date.now() + 5000) {
      Alert.alert(
        'Choose a future time',
        'Your reminder must be scheduled for a future date and time.'
      );
      return;
    }

    setWorking(true);

    try {
      const date = await scheduleItemReminderAt(
        item,
        userId,
        selectedDate
      );

      onClose();

      Alert.alert(
        existing
          ? 'Reminder updated'
          : 'Reminder scheduled',
        `Folio will remind you on ${formatDateTime(date)}.`
      );
    } catch (error) {
      Alert.alert(
        'Could not schedule reminder',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setWorking(false);
    }
  }

  function handleCancelReminder() {
    if (!item || !userId || !existing || working) {
      return;
    }

    Alert.alert(
      'Cancel this reminder?',
      'The saved item will stay in your Library.',
      [
        {
          text: 'Keep Reminder',
          style: 'cancel',
        },
        {
          text: 'Cancel Reminder',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setWorking(true);

              try {
                await cancelRemindersForItem(
                  item.id,
                  userId
                );

                setExisting(null);
                onClose();

                Alert.alert(
                  'Reminder cancelled',
                  'Your saved item is unchanged.'
                );
              } catch (error) {
                Alert.alert(
                  'Could not cancel reminder',
                  error instanceof Error
                    ? error.message
                    : 'Please try again.'
                );
              } finally {
                setWorking(false);
              }
            })();
          },
        },
      ]
    );
  }

  const disabled = loading || working || !item || !userId;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          disabled={working}
          accessibilityLabel="Close reminder picker"
        />

        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 18),
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>
                A LITTLE NUDGE
              </Text>

              <Text style={styles.heading}>
                Remind me later
              </Text>

              <Text
                style={styles.subtitle}
                numberOfLines={2}
              >
                {item?.title ?? 'Saved item'}
              </Text>
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              disabled={working}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>
                REMINDER STATUS
              </Text>

              <Text style={styles.statusValue}>
                {loading
                  ? 'Checking reminders…'
                  : existing
                    ? 'Reminder scheduled'
                    : 'No reminder scheduled'}
              </Text>

              {existing?.scheduledFor ? (
                <Text style={styles.statusDetail}>
                  {formatDateTime(
                    existing.scheduledFor
                  )}
                </Text>
              ) : null}
            </View>

            <Text style={styles.sectionLabel}>
              CHOOSE A DATE AND TIME
            </Text>

            <View style={styles.selectionCard}>
              <View style={styles.selectionRow}>
                <View>
                  <Text style={styles.selectionLabel}>
                    Date
                  </Text>
                  <Text style={styles.selectionValue}>
                    {selectedDate.toLocaleDateString(
                      undefined,
                      {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }
                    )}
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.changeButton,
                    Platform.OS === 'ios' &&
                      pickerMode === 'date' &&
                      styles.activeChangeButton,
                  ]}
                  onPress={() => {
                    setPickerMode('date');

                    if (Platform.OS === 'android') {
                      setAndroidPickerMode('date');
                    }
                  }}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel="Choose reminder date"
                >
                  <Text style={styles.changeButtonText}>
                    Change date
                  </Text>
                </Pressable>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.selectionRow}>
                <View>
                  <Text style={styles.selectionLabel}>
                    Time
                  </Text>
                  <Text style={styles.selectionValue}>
                    {selectedDate.toLocaleTimeString(
                      undefined,
                      {
                        hour: 'numeric',
                        minute: '2-digit',
                      }
                    )}
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.changeButton,
                    Platform.OS === 'ios' &&
                      pickerMode === 'time' &&
                      styles.activeChangeButton,
                  ]}
                  onPress={() => {
                    setPickerMode('time');

                    if (Platform.OS === 'android') {
                      setAndroidPickerMode('time');
                    }
                  }}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel="Choose reminder time"
                >
                  <Text style={styles.changeButtonText}>
                    Change time
                  </Text>
                </Pressable>
              </View>

              {Platform.OS === 'ios' ? (
                <View style={styles.wheelContainer}>
                  <DateTimePicker
                    key={pickerMode}
                    value={selectedDate}
                    mode={pickerMode}
                    display="spinner"
                    onChange={handlePickerChange}
                    minimumDate={
                      pickerMode === 'date'
                        ? new Date()
                        : undefined
                    }
                    themeVariant={
                      isDark ? 'dark' : 'light'
                    }
                    textColor={colors.text}
                    style={styles.wheel}
                  />
                </View>
              ) : null}
            </View>

            {Platform.OS === 'android' &&
            androidPickerMode ? (
              <DateTimePicker
                value={selectedDate}
                mode={androidPickerMode}
                display="default"
                minimumDate={
                  androidPickerMode === 'date'
                    ? new Date()
                    : undefined
                }
                onChange={handlePickerChange}
              />
            ) : null}

            <Text style={styles.previewLabel}>
              YOUR REMINDER
            </Text>

            <Text style={styles.previewText}>
              {formatDateTime(selectedDate)}
            </Text>

            <Pressable
              style={[
                styles.primaryButton,
                disabled && styles.disabledButton,
              ]}
              disabled={disabled}
              onPress={() => void handleSchedule()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>
                {working
                  ? 'Please wait…'
                  : existing
                    ? 'Reschedule Reminder'
                    : 'Schedule Reminder'}
              </Text>
            </Pressable>

            {existing ? (
              <Pressable
                style={styles.cancelReminderButton}
                disabled={disabled}
                onPress={handleCancelReminder}
                accessibilityRole="button"
              >
                <Text style={styles.cancelReminderText}>
                  Cancel Existing Reminder
                </Text>
              </Pressable>
            ) : null}

            <Text style={styles.footerNote}>
              Notifications are scheduled on this device.
              You can change or cancel your reminder later.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(
  c: (typeof palettes)['light']
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.48)',
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '92%',
      overflow: 'hidden',
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      marginTop: 11,
      marginBottom: 8,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 13,
      paddingBottom: 15,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerCopy: {
      flex: 1,
      paddingRight: 12,
    },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 2,
      fontWeight: '800',
      color: c.accent,
      marginBottom: 7,
    },
    heading: {
      fontSize: 25,
      fontWeight: '700',
      letterSpacing: -0.6,
      color: c.text,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 19,
      color: c.secondary,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      color: c.text,
      fontSize: 25,
      lineHeight: 29,
      fontWeight: '300',
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 20,
    },
    statusCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.muted,
      marginBottom: 23,
    },
    statusLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: c.secondary,
      marginBottom: 7,
    },
    statusValue: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },
    statusDetail: {
      fontSize: 13,
      color: c.secondary,
      marginTop: 5,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      color: c.secondary,
      marginBottom: 12,
    },
    selectionCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 15,
      overflow: 'hidden',
    },
    selectionRow: {
      minHeight: 74,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    selectionLabel: {
      fontSize: 12,
      color: c.secondary,
      marginBottom: 4,
    },
    selectionValue: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    changeButton: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.muted,
    },
    activeChangeButton: {
      borderWidth: 1,
      borderColor: c.accent,
    },
    changeButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.accent,
    },
    wheelContainer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheel: {
      width: '100%',
      height: 185,
    },
    previewLabel: {
      textAlign: 'center',
      marginTop: 19,
      color: c.secondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.4,
    },
    previewText: {
      color: c.text,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '600',
      marginTop: 8,
      marginBottom: 19,
    },
    primaryButton: {
      minHeight: 54,
      borderRadius: 15,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: c.buttonText,
      fontSize: 15,
      fontWeight: '700',
    },
    disabledButton: {
      opacity: 0.5,
    },
    cancelReminderButton: {
      minHeight: 49,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    cancelReminderText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.danger,
    },
    footerNote: {
      color: c.secondary,
      fontSize: 11,
      lineHeight: 17,
      textAlign: 'center',
      marginTop: 13,
    },
  });
}
