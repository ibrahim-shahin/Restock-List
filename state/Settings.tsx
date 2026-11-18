import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setHapticsEnabled } from '@/utils/haptics';
import { getLocalItem, setLocalItem } from './localStore';

const SETTINGS_KEY = 'home-stock:settings:v1';

// Days since the last backup before the Stock screen reminds you; 0 turns it off.
export const BACKUP_REMINDER_OPTIONS = [
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
  { days: 0, label: 'Off' },
] as const;

export type Settings = {
  backupReminderDays: number;
  haptics: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  backupReminderDays: 14,
  haptics: true,
};

/** Saved settings; each missing or invalid value falls back to its default. */
export function readSettings(saved: string | null): Settings {
  let value: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(saved ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      value = parsed as Record<string, unknown>;
    }
  } catch {
    // Use the defaults.
  }
  return {
    backupReminderDays: BACKUP_REMINDER_OPTIONS.some(
      (option) => option.days === value.backupReminderDays,
    )
      ? (value.backupReminderDays as number)
      : DEFAULT_SETTINGS.backupReminderDays,
    haptics: typeof value.haptics === 'boolean' ? value.haptics : DEFAULT_SETTINGS.haptics,
  };
}

type SettingsValue = {
  settings: Settings;
  // False until the saved settings have loaded.
  isReady: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
};

// Without a provider (in tests), the defaults apply.
const SettingsContext = createContext<SettingsValue>({
  settings: DEFAULT_SETTINGS,
  isReady: true,
  updateSettings: () => undefined,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getLocalItem(SETTINGS_KEY)
      .catch(() => null)
      .then((saved) => {
        if (!isMounted) return;
        setSettings(readSettings(saved));
        setIsReady(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void setLocalItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
  }, [isReady, settings]);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ settings, isReady, updateSettings }),
    [settings, isReady, updateSettings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
