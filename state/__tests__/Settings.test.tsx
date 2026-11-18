import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { setHapticsEnabled } from '@/utils/haptics';
import { readSettings, SettingsProvider, useSettings } from '../Settings';

const mockStorage = new Map<string, string>();

jest.mock('../localStore', () => ({
  getLocalItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
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

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
});

it('starts with the defaults', async () => {
  const { result } = await renderSettings();

  expect(result.current.settings).toEqual({ backupReminderDays: 14, haptics: true });
  expect(setHapticsEnabled).toHaveBeenLastCalledWith(true);
});

it('loads saved settings', async () => {
  mockStorage.set(KEY, JSON.stringify({ backupReminderDays: 30, haptics: false }));

  const { result } = await renderSettings();

  expect(result.current.settings).toEqual({ backupReminderDays: 30, haptics: false });
  expect(setHapticsEnabled).toHaveBeenLastCalledWith(false);
});

it('saves changes and applies the vibration setting', async () => {
  const { result } = await renderSettings();

  await act(() => {
    result.current.updateSettings({ haptics: false });
  });

  expect(result.current.settings.haptics).toBe(false);
  expect(setHapticsEnabled).toHaveBeenLastCalledWith(false);
  await waitFor(() => expect(JSON.parse(mockStorage.get(KEY) ?? '{}')).toEqual({ backupReminderDays: 14, haptics: false }));
});

it('falls back to the default for each value that is missing or invalid', () => {
  expect(readSettings('not json')).toEqual({ backupReminderDays: 14, haptics: true });
  expect(readSettings(JSON.stringify({ backupReminderDays: 9, haptics: 'yes' }))).toEqual({
    backupReminderDays: 14,
    haptics: true,
  });
  expect(readSettings(JSON.stringify({ backupReminderDays: 0 }))).toEqual({ backupReminderDays: 0, haptics: true });
});

it('works with the defaults outside a provider', async () => {
  const { result } = await renderHook(() => useSettings());

  expect(result.current.settings.backupReminderDays).toBe(14);
  expect(() => result.current.updateSettings({ haptics: false })).not.toThrow();
});
