import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import ReminderScreen from '@/app/reminder';

type Settings = { enabled: boolean; weekday: number; hour: number };
const mockReminder = { current: { enabled: false, weekday: 7, hour: 10 } as Settings };
const mockSaveReminder = jest.fn((_next: Settings) => Promise.resolve(true));

// Holds the reminder in React state and keeps it on a successful save, like the real provider.
jest.mock('@/state/Reminder', () => {
  const { useState } = jest.requireActual('react');
  return {
    useReminder: () => {
      const [reminder, setReminder] = useState(mockReminder.current);
      const saveReminder = async (next: Settings) => {
        const saved = await mockSaveReminder(next);
        if (saved) setReminder(next);
        return saved;
      };
      return { reminder, saveReminder };
    },
  };
});
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReminder.current = { enabled: false, weekday: 7, hour: 10 };
});

it('turns the reminder on with the switch', async () => {
  await render(<ReminderScreen />);

  await fireEvent(screen.getByTestId('reminder-switch'), 'valueChange', true);

  expect(mockSaveReminder).toHaveBeenCalledWith({ enabled: true, weekday: 7, hour: 10 });
});

it('changes the day and time', async () => {
  mockReminder.current = { enabled: true, weekday: 7, hour: 10 };
  await render(<ReminderScreen />);

  await fireEvent.press(screen.getByTestId('reminder-day-Mon'));
  expect(mockSaveReminder).toHaveBeenLastCalledWith({ enabled: true, weekday: 2, hour: 10 });
  // The chips are disabled while saving; wait for the saved day to show.
  await waitFor(() => expect(screen.getByText(/^Every Monday/)).toBeTruthy());

  await fireEvent.press(screen.getByTestId('reminder-hour-18'));
  expect(mockSaveReminder).toHaveBeenLastCalledWith({ enabled: true, weekday: 2, hour: 18 });
});

it('explains how to allow notifications when permission is refused', async () => {
  mockSaveReminder.mockResolvedValueOnce(false);
  await render(<ReminderScreen />);

  await fireEvent(screen.getByTestId('reminder-switch'), 'valueChange', true);

  await waitFor(() => expect(screen.getByText(/needs permission to send notifications/)).toBeTruthy());
  expect(screen.getByTestId('open-settings-button')).toBeTruthy();
});

it('checks permission again after coming back from the phone settings', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
  const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
  getPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: false });
  mockReminder.current = { enabled: true, weekday: 7, hour: 10 };
  await render(<ReminderScreen />);
  await waitFor(() => expect(screen.getByText(/Notifications are turned off/)).toBeTruthy());

  getPermissions.mockResolvedValueOnce({ granted: true, canAskAgain: true });
  await act(async () => {
    listeners.forEach((listener) => listener('active'));
  });

  await waitFor(() => expect(screen.queryByText(/Notifications are turned off/)).toBeNull());
  jest.restoreAllMocks();
});
