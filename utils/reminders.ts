import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ReminderSettings = {
  enabled: boolean;
  // 1-7, starting with Sunday, as expo-notifications numbers weekdays.
  weekday: number;
  hour: number;
};

export const WEEKDAYS = [
  { value: 1, short: 'Sun', name: 'Sunday' },
  { value: 2, short: 'Mon', name: 'Monday' },
  { value: 3, short: 'Tue', name: 'Tuesday' },
  { value: 4, short: 'Wed', name: 'Wednesday' },
  { value: 5, short: 'Thu', name: 'Thursday' },
  { value: 6, short: 'Fri', name: 'Friday' },
  { value: 7, short: 'Sat', name: 'Saturday' },
] as const;

export const REMINDER_HOURS = [8, 10, 12, 15, 18, 20] as const;

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, weekday: 7, hour: 10 };

// Tapping the reminder opens the stock check.
export const REMINDER_URL = '/stock-check' as const;

const CHANNEL_ID = 'stock-check-reminders';
const NOTIFICATION_ID = 'weekly-stock-check';

export function formatHour(hour: number): string {
  return new Date(2026, 0, 4, hour).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function describeReminder(settings: ReminderSettings): string {
  if (!settings.enabled) return 'Off. Tap to set a weekly reminder.';
  const day = WEEKDAYS.find((weekday) => weekday.value === settings.weekday)?.name;
  return `Every ${day} at ${formatHour(settings.hour)}`;
}

/** A saved or backed-up reminder setting, or null when it isn't valid. */
export function reminderFromValue(input: unknown): ReminderSettings | null {
  if (!input || typeof input !== 'object') return null;
  const { enabled, weekday, hour } = input as Record<string, unknown>;
  if (
    typeof enabled === 'boolean' &&
    typeof weekday === 'number' &&
    Number.isInteger(weekday) &&
    weekday >= 1 &&
    weekday <= 7 &&
    typeof hour === 'number' &&
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23
  ) {
    return { enabled, weekday, hour };
  }
  return null;
}

/** Saved settings, or the defaults when nothing valid was saved. */
export function readReminderSettings(saved: string | null): ReminderSettings {
  try {
    return reminderFromValue(JSON.parse(saved ?? '')) ?? DEFAULT_REMINDER;
  } catch {
    return DEFAULT_REMINDER;
  }
}

/**
 * Schedules (or re-schedules) the weekly reminder. Asks for notification
 * permission only when askPermission is set; returns false without
 * scheduling when permission isn't granted.
 */
export async function scheduleWeeklyReminder(
  settings: ReminderSettings,
  { askPermission }: { askPermission: boolean },
): Promise<boolean> {
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && askPermission && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return false;

  // Android groups notifications in channels; this is a no-op elsewhere.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Stock check reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await cancelWeeklyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: 'Time for a stock check',
      body: "See what you're running low on before your next shop.",
      data: { url: REMINDER_URL },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      channelId: CHANNEL_ID,
      weekday: settings.weekday,
      hour: settings.hour,
      minute: 0,
    },
  });
  return true;
}

export async function cancelWeeklyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => undefined);
}

export function isReminderTap(response: Notifications.NotificationResponse | null): boolean {
  return response?.notification.request.content.data?.url === REMINDER_URL;
}

// Show the reminder even when it arrives while the app is open.
export function showRemindersWhileOpen() {
  // The web preview has no notifications.
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
