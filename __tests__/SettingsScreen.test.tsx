import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import SettingsScreen from '@/app/settings';

const mockUpdateSettings = jest.fn();
const mockSettings = {
  current: {
    backupReminderDays: 14,
    haptics: true,
    theme: 'system',
    colorTheme: 'forest',
    placeOrder: [] as string[],
    keepScreenOn: false,
  },
};
const mockLocations = { current: ['Pantry', 'Fridge', 'Bathroom', 'Kitchen'] };

jest.mock('@/state/StockContext', () => ({
  useStock: () => ({ items: mockLocations.current.map((location) => ({ location })) }),
}));

jest.mock('@/state/Settings', () => ({
  ...jest.requireActual('@/state/Settings'),
  useSettings: () => ({
    settings: { ...mockSettings.current },
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
  mockSettings.current = { ...mockSettings.current, placeOrder: [] };
  mockLocations.current = ['Pantry', 'Fridge', 'Bathroom', 'Kitchen'];
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

it('summarises the stock check route and opens it', async () => {
  await render(<SettingsScreen />);
  expect(screen.getByText('A to Z by storage place. Tap to set your own order.')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('settings-check-route'));
  expect(router.push).toHaveBeenCalledWith('/check-route');
});

it('shows the start of a custom route', async () => {
  mockSettings.current = { ...mockSettings.current, placeOrder: ['Kitchen', 'Fridge', 'Pantry', 'Bathroom'] };

  await render(<SettingsScreen />);

  expect(screen.getByText('Kitchen → Fridge → Pantry → …')).toBeTruthy();
});

it('turns on keeping the screen on while shopping', async () => {
  await render(<SettingsScreen />);

  await fireEvent(screen.getByTestId('settings-keep-screen-on'), 'valueChange', true);

  expect(mockUpdateSettings).toHaveBeenCalledWith({ keepScreenOn: true });
});

it('turns prices on and sets the currency label', async () => {
  await render(<SettingsScreen />);
  expect(screen.queryByTestId('settings-currency')).toBeNull();

  await fireEvent(screen.getByTestId('settings-show-prices'), 'valueChange', true);
  expect(mockUpdateSettings).toHaveBeenCalledWith({ showPrices: true });
});

it('shows the currency field while prices are on', async () => {
  mockSettings.current = { ...mockSettings.current, showPrices: true, currency: '' } as typeof mockSettings.current;
  await render(<SettingsScreen />);

  await fireEvent.changeText(screen.getByTestId('settings-currency'), 'JD');
  expect(mockUpdateSettings).toHaveBeenCalledWith({ currency: 'JD' });

  await fireEvent.press(screen.getByTestId('price-decimals-3'));
  expect(mockUpdateSettings).toHaveBeenCalledWith({ priceDecimals: 3 });
  expect(screen.getByTestId('price-decimals-3').props.accessibilityLabel).toBe('Three decimals');
});
