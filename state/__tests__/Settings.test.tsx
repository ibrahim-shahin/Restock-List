import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { setHapticsEnabled } from '@/utils/haptics';
import { readSettings, SettingsProvider, useSettings } from '../Settings';

const mockStorage = new Map<string, string>();
const mockRead = { delay: null as Promise<void> | null, failures: 0 };

jest.mock('../localStore', () => ({
  getLocalItem: jest.fn(async (key: string) => {
    if (mockRead.delay) await mockRead.delay;
    if (mockRead.failures > 0) {
      mockRead.failures -= 1;
      throw new Error('database is locked');
    }
    return mockStorage.get(key) ?? null;
  }),
  setLocalItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
}));
jest.mock('@/utils/haptics', () => ({ setHapticsEnabled: jest.fn() }));

const KEY = 'home-stock:settings:v1';

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

async function renderSettings() {
  const hook = await renderHook(() => useSettings(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.isReady).toBe(true));
  return hook;
}

const DEFAULTS = { backupReminderDays: 14, haptics: true, theme: 'system', colorTheme: 'forest' };

beforeEach(() => {
  mockStorage.clear();
  mockRead.delay = null;
  mockRead.failures = 0;
  jest.clearAllMocks();
  jest.useRealTimers();
});

it('starts with the defaults', async () => {
  const { result } = await renderSettings();

  expect(result.current.settings).toEqual(DEFAULTS);
  expect(setHapticsEnabled).toHaveBeenLastCalledWith(true);
});

it('loads saved settings', async () => {
  mockStorage.set(KEY, JSON.stringify({ backupReminderDays: 30, haptics: false, theme: 'dark', colorTheme: 'plum' }));

  const { result } = await renderSettings();

  expect(result.current.settings).toEqual({ backupReminderDays: 30, haptics: false, theme: 'dark', colorTheme: 'plum' });
  expect(setHapticsEnabled).toHaveBeenLastCalledWith(false);
});

it('saves changes and applies the vibration setting', async () => {
  const { result } = await renderSettings();

  await act(() => {
    result.current.updateSettings({ haptics: false });
  });

  expect(result.current.settings.haptics).toBe(false);
  expect(setHapticsEnabled).toHaveBeenLastCalledWith(false);
  await waitFor(() => expect(JSON.parse(mockStorage.get(KEY) ?? '{}')).toEqual({ ...DEFAULTS, haptics: false }));
});

it('falls back to the default for each value that is missing or invalid', () => {
  expect(readSettings('not json')).toEqual(DEFAULTS);
  expect(
    readSettings(JSON.stringify({ backupReminderDays: 9, haptics: 'yes', theme: 'sepia', colorTheme: 'neon' })),
  ).toEqual(DEFAULTS);
  expect(readSettings(JSON.stringify({ backupReminderDays: 0 }))).toEqual({ ...DEFAULTS, backupReminderDays: 0 });
});

it('works with the defaults outside a provider', async () => {
  const { result } = await renderHook(() => useSettings());

  expect(result.current.settings.backupReminderDays).toBe(14);
  expect(() => result.current.updateSettings({ haptics: false })).not.toThrow();
});

it('makes native dialogs and switches follow the chosen theme', async () => {
  const setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  const { result } = await renderSettings();
  expect(setColorScheme).toHaveBeenLastCalledWith('unspecified');

  await act(() => {
    result.current.updateSettings({ theme: 'dark' });
  });
  expect(setColorScheme).toHaveBeenLastCalledWith('dark');

  await act(() => {
    result.current.updateSettings({ theme: 'system' });
  });
  expect(setColorScheme).toHaveBeenLastCalledWith('unspecified');
  setColorScheme.mockRestore();
});

it('starts after a short wait if storage is slow, then keeps your changes when the saved settings arrive', async () => {
  jest.useFakeTimers();
  mockStorage.set(KEY, JSON.stringify({ ...DEFAULTS, theme: 'dark', backupReminderDays: 30 }));
  let finishRead = () => undefined as void;
  mockRead.delay = new Promise<void>((resolve) => {
    finishRead = resolve;
  });
  const { result } = await renderHook(() => useSettings(), { wrapper: Wrapper });
  expect(result.current.isReady).toBe(false);

  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(result.current.isReady).toBe(true);
  await act(() => {
    result.current.updateSettings({ haptics: false });
  });
  expect(mockStorage.get(KEY)).toContain('"theme":"dark"');

  await act(async () => {
    finishRead();
    await Promise.resolve();
  });

  expect(result.current.settings).toEqual({ ...DEFAULTS, theme: 'dark', backupReminderDays: 30, haptics: false });
});

it("never saves over your settings when they can't be read, and tries again", async () => {
  jest.useFakeTimers();
  const saved = JSON.stringify({ ...DEFAULTS, theme: 'dark', colorTheme: 'plum' });
  mockStorage.set(KEY, saved);
  mockRead.failures = 2;
  const { result } = await renderHook(() => useSettings(), { wrapper: Wrapper });

  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.isReady).toBe(true);
  expect(result.current.settings).toEqual(DEFAULTS);
  await act(() => {
    result.current.updateSettings({ haptics: false });
  });
  expect(mockStorage.get(KEY)).toBe(saved);

  await act(async () => {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });
  expect(mockStorage.get(KEY)).toBe(saved);
  await act(async () => {
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
  });

  expect(result.current.settings).toEqual({ ...DEFAULTS, theme: 'dark', colorTheme: 'plum', haptics: false });
  await waitFor(() => expect(JSON.parse(mockStorage.get(KEY) ?? '{}').haptics).toBe(false));
  expect(JSON.parse(mockStorage.get(KEY) ?? '{}').theme).toBe('dark');
});
