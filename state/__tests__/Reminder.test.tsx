import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { cancelWeeklyReminder, scheduleWeeklyReminder } from '@/utils/reminders';
import { ReminderProvider, useReminder } from '../Reminder';

const mockStorage = new Map<string, string>();

jest.mock('../localStore', () => ({
  getLocalItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setLocalItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
}));
jest.mock('expo-notifications', () => ({}));
jest.mock('@/utils/reminders', () => ({
  ...jest.requireActual('@/utils/reminders'),
  scheduleWeeklyReminder: jest.fn(() => Promise.resolve(true)),
  cancelWeeklyReminder: jest.fn(() => Promise.resolve()),
}));

const KEY = 'home-stock:reminder:v1';
const schedule = scheduleWeeklyReminder as jest.Mock;
const cancel = cancelWeeklyReminder as jest.Mock;
const mondayAtSix = { enabled: true, weekday: 2, hour: 18 };

function Wrapper({ children }: { children: ReactNode }) {
  return <ReminderProvider>{children}</ReminderProvider>;
}

async function renderReminder() {
  const hook = await renderHook(() => useReminder(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.reminder).not.toBeNull());
  return hook;
}

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
});

it('starts switched off', async () => {
  const { result } = await renderReminder();

  expect(result.current.reminder).toEqual({ enabled: false, weekday: 7, hour: 10 });
  expect(schedule).not.toHaveBeenCalled();
});

it('restores a saved reminder without asking for permission', async () => {
  mockStorage.set(KEY, JSON.stringify(mondayAtSix));

  const { result } = await renderReminder();

  expect(result.current.reminder).toEqual(mondayAtSix);
  expect(schedule).toHaveBeenCalledWith(mondayAtSix, { askPermission: false });
});

it('turns the reminder on and saves it', async () => {
  const { result } = await renderReminder();

  let saved: boolean | undefined;
  await act(async () => {
    saved = await result.current.saveReminder(mondayAtSix);
  });

  expect(saved).toBe(true);
  expect(schedule).toHaveBeenCalledWith(mondayAtSix, { askPermission: true });
  expect(result.current.reminder).toEqual(mondayAtSix);
  expect(mockStorage.get(KEY)).toBe(JSON.stringify(mondayAtSix));
});

it('keeps the old setting when notification permission is refused', async () => {
  const { result } = await renderReminder();
  schedule.mockResolvedValueOnce(false);

  let saved: boolean | undefined;
  await act(async () => {
    saved = await result.current.saveReminder(mondayAtSix);
  });

  expect(saved).toBe(false);
  expect(result.current.reminder?.enabled).toBe(false);
  expect(mockStorage.has(KEY)).toBe(false);
});

it('turns the reminder off', async () => {
  mockStorage.set(KEY, JSON.stringify(mondayAtSix));
  const { result } = await renderReminder();

  await act(async () => {
    await result.current.saveReminder({ ...mondayAtSix, enabled: false });
  });

  expect(cancel).toHaveBeenCalled();
  expect(result.current.reminder?.enabled).toBe(false);
  expect(JSON.parse(mockStorage.get(KEY) ?? '{}').enabled).toBe(false);
});
