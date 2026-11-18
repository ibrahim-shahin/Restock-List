import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';
import { COLOR_THEMES, type ColorThemeKey } from '@/constants/colors';
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

export const THEME_OPTIONS = [
  { value: 'system', label: 'Like my phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export type ThemeSetting = (typeof THEME_OPTIONS)[number]['value'];

export type Settings = {
  backupReminderDays: number;
  haptics: boolean;
  theme: ThemeSetting;
  colorTheme: ColorThemeKey;
  // Storage places in the order stock checks visit them; empty means A to Z.
  placeOrder: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  backupReminderDays: 14,
  haptics: true,
  theme: 'system',
  colorTheme: 'forest',
  placeOrder: [],
};

const MAX_ROUTE_PLACES = 100;

// If storage doesn't answer by then, start with the defaults anyway.
const LOAD_TIMEOUT_MS = 2000;
// A failed read is tried again this many times, waiting a little longer each time.
const MAX_LOAD_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1000;

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
    theme: THEME_OPTIONS.some((option) => option.value === value.theme)
      ? (value.theme as ThemeSetting)
      : DEFAULT_SETTINGS.theme,
    colorTheme: COLOR_THEMES.some((option) => option.key === value.colorTheme)
      ? (value.colorTheme as ColorThemeKey)
      : DEFAULT_SETTINGS.colorTheme,
    placeOrder: Array.isArray(value.placeOrder)
      ? value.placeOrder
          .filter((place): place is string => typeof place === 'string' && place.trim() !== '')
          .map((place) => place.trim())
          .slice(0, MAX_ROUTE_PLACES)
      : DEFAULT_SETTINGS.placeOrder,
  };
}

type SettingsValue = {
  settings: Settings;
  // False until the saved settings have loaded (or loading took too long).
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  // Changes made before the saved settings arrive, re-applied on top of them.
  const earlyChangesRef = useRef<Partial<Settings>>({});
  const isReady = hasLoaded || timedOut;

  useEffect(() => {
    let isMounted = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);

    function load(attempt: number) {
      getLocalItem(SETTINGS_KEY).then(
        (saved) => {
          if (!isMounted) return;
          clearTimeout(timeout);
          setSettings({ ...readSettings(saved), ...earlyChangesRef.current });
          setHasLoaded(true);
        },
        () => {
          // Couldn't read them: start with the defaults, but keep saving off
          // so the saved settings aren't replaced, and try again shortly.
          if (!isMounted) return;
          clearTimeout(timeout);
          setTimedOut(true);
          if (attempt < MAX_LOAD_ATTEMPTS) {
            retry = setTimeout(() => load(attempt + 1), RETRY_DELAY_MS * attempt);
          }
        },
      );
    }

    load(1);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      clearTimeout(retry);
    };
  }, []);

  // Saved only once loaded, so the defaults never replace saved settings.
  useEffect(() => {
    if (!hasLoaded) return;
    void setLocalItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
  }, [hasLoaded, settings]);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  // Native parts (dialogs, keyboard, switches) follow the chosen theme too.
  useEffect(() => {
    if (!isReady || Platform.OS === 'web') return;
    Appearance.setColorScheme(settings.theme === 'system' ? 'unspecified' : settings.theme);
  }, [isReady, settings.theme]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    earlyChangesRef.current = { ...earlyChangesRef.current, ...patch };
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
