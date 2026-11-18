import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import SettingsScreen from '@/app/settings';

const mockUpdateSettings = jest.fn();

jest.mock('@/state/Settings', () => ({
  ...jest.requireActual('@/state/Settings'),
  useSettings: () => ({
    settings: { backupReminderDays: 14, haptics: true, theme: 'system', colorTheme: 'forest' },
    isReady: true,
    updateSettings: mockUpdateSettings,
  }),
}));
jest.mock('@/state/Reminder', () => ({
  useReminder: () => ({ reminder: { enabled: true, weekday: 7, hour: 10 } }),
}));
jest.mock('expo-notifications', () => ({}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('shows the weekly reminder and opens its screen', async () => {
  await render(<SettingsScreen />);

  expect(screen.getByText(/^Every Saturday at 10/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('settings-weekly-reminder'));

  expect(router.push).toHaveBeenCalledWith('/reminder');
});

it('changes how often the backup reminder appears', async () => {
  await render(<SettingsScreen />);
  expect(screen.getByTestId('backup-reminder-days-14').props.accessibilityState).toEqual({ selected: true });

  await fireEvent.press(screen.getByTestId('backup-reminder-days-30'));
  expect(mockUpdateSettings).toHaveBeenLastCalledWith({ backupReminderDays: 30 });

  await fireEvent.press(screen.getByTestId('backup-reminder-days-0'));
  expect(mockUpdateSettings).toHaveBeenLastCalledWith({ backupReminderDays: 0 });
});

it('turns vibration off', async () => {
  await render(<SettingsScreen />);

  await fireEvent(screen.getByTestId('settings-vibration'), 'valueChange', false);

  expect(mockUpdateSettings).toHaveBeenCalledWith({ haptics: false });
});

it('switches between following the phone, light and dark', async () => {
  await render(<SettingsScreen />);
  expect(screen.getByTestId('theme-system').props.accessibilityState).toEqual({ selected: true });

  await fireEvent.press(screen.getByTestId('theme-dark'));
  expect(mockUpdateSettings).toHaveBeenLastCalledWith({ theme: 'dark' });

  await fireEvent.press(screen.getByTestId('theme-light'));
  expect(mockUpdateSettings).toHaveBeenLastCalledWith({ theme: 'light' });
});

it('picks a colour theme', async () => {
  await render(<SettingsScreen />);
  expect(screen.getByTestId('color-theme-forest').props.accessibilityState).toEqual({ selected: true });

  await fireEvent.press(screen.getByTestId('color-theme-ocean'));

  expect(mockUpdateSettings).toHaveBeenCalledWith({ colorTheme: 'ocean' });
});
