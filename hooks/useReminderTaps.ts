import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { Platform } from 'react-native';
import { isReminderTap, REMINDER_URL } from '@/utils/reminders';

/** Tapping the weekly reminder opens the stock check, also when it starts the app. */
export function useReminderTaps() {
  const pathname = usePathname();

  const openStockCheck = useEffectEvent(
    (response: Notifications.NotificationResponse | null) => {
      if (!isReminderTap(response)) return;
      // Forget the tap so a later launch doesn't open the check again.
      Notifications.clearLastNotificationResponse();
      // A check that is already open stays as it is, instead of a second one on top.
      if (pathname !== REMINDER_URL) router.push(REMINDER_URL);
    },
  );

  useEffect(() => {
    // The web preview has no notifications.
    if (Platform.OS === 'web') return;
    openStockCheck(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      openStockCheck(response),
    );
    return () => subscription.remove();
  }, []);
}
