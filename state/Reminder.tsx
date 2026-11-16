import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  cancelWeeklyReminder,
  readReminderSettings,
  scheduleWeeklyReminder,
  type ReminderSettings,
} from '@/utils/reminders';
import { getLocalItem, setLocalItem } from './localStore';

const REMINDER_KEY = 'home-stock:reminder:v1';

type ReminderValue = {
  // null until the saved settings have loaded.
  reminder: ReminderSettings | null;
  // Resolves to false when notification permission was refused; nothing changes then.
  saveReminder: (next: ReminderSettings) => Promise<boolean>;
};

const ReminderContext = createContext<ReminderValue | null>(null);

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);

  useEffect(() => {
    let isMounted = true;
    getLocalItem(REMINDER_KEY)
      .catch(() => null)
      .then((saved) => {
        if (!isMounted) return;
        const settings = readReminderSettings(saved);
        setReminder((current) => current ?? settings);
        // Re-create the scheduled reminder in case Android dropped it. This
        // never asks for permission; it does nothing if permission is off.
        if (settings.enabled) {
          scheduleWeeklyReminder(settings, { askPermission: false }).catch(() => undefined);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const saveReminder = useCallback(async (next: ReminderSettings) => {
    if (next.enabled) {
      const scheduled = await scheduleWeeklyReminder(next, { askPermission: true });
      if (!scheduled) return false;
    } else {
      await cancelWeeklyReminder();
    }
    setReminder(next);
    await setLocalItem(REMINDER_KEY, JSON.stringify(next));
    return true;
  }, []);

  const value = useMemo(() => ({ reminder, saveReminder }), [reminder, saveReminder]);
  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminder() {
  const value = useContext(ReminderContext);
  if (!value) throw new Error('useReminder must be used inside ReminderProvider.');
  return value;
}
