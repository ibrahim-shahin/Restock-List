import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import StockHomeScreen from '@/app/(tabs)/index';
import { DEFAULT_SETTINGS, type Settings } from '@/state/Settings';
import type { StockItem } from '@/state/StockContext';

function mockItem(id: string, name: string, location: string, storeTypes: string[], createdAt: number): StockItem {
  return { id, name, unit: '', location, storeTypes, createdAt };
}

const mockItems = [
  mockItem('milk', 'Milk', 'Fridge', ['Supermarket'], 3),
  mockItem('rice', 'Rice', 'Pantry', ['Market', 'Supermarket'], 2),
  mockItem('yogurt', 'Yogurt', 'Fridge', ['Supermarket'], 1),
];

const mockUpdateSettings = jest.fn();
const mockSettings: { current: Settings } = { current: DEFAULT_SETTINGS };
jest.mock('@/state/Settings', () => ({
  ...jest.requireActual('@/state/Settings'),
  useSettings: () => ({ settings: mockSettings.current, updateSettings: mockUpdateSettings, isReady: true }),
}));
jest.mock('@/state/StockContext', () => ({
  useStock: () => ({
    items: mockItems,
    shoppingList: [],
    isLoading: false,
    storageError: null,
    loadProblem: null,
    loadNotice: null,
    addToBuyList: jest.fn(),
  }),
}));
jest.mock('@/state/BackupStatus', () => ({
  useBackupStatus: () => ({ lastBackupAt: 1, checkedAt: 2 }),
}));
jest.mock('@/state/Reminder', () => ({
  useReminder: () => ({ reminder: { enabled: false, weekday: 7, hour: 10 } }),
}));
jest.mock('expo-notifications', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const itemIds = (scope: Pick<typeof screen, 'queryAllByTestId'> = screen) =>
  scope.queryAllByTestId(/^stock-item-/).map((element) => element.props.testID.replace('stock-item-', ''));
const groupTitles = () =>
  screen.queryAllByTestId(/^stock-group-/).map((element) => element.props.testID.replace('stock-group-', ''));

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings.current = DEFAULT_SETTINGS;
});

it('shows one list until you choose a grouping, and remembers the choice', async () => {
  await render(<StockHomeScreen />);
  expect(groupTitles()).toEqual([]);
  expect(itemIds()).toEqual(['milk', 'rice', 'yogurt']);
  expect(screen.getByTestId('group-by-place').props.accessibilityState).toEqual({ selected: false });

  await fireEvent.press(screen.getByTestId('group-by-place'));
  expect(mockUpdateSettings).toHaveBeenLastCalledWith({ stockGroupBy: 'place' });
  await fireEvent.press(screen.getByTestId('group-by-store'));
  expect(mockUpdateSettings).toHaveBeenLastCalledWith({ stockGroupBy: 'store' });
});

it('groups by storage place in the order of your stock-check route', async () => {
  mockSettings.current = { ...DEFAULT_SETTINGS, stockGroupBy: 'place', placeOrder: ['Pantry'] };
  await render(<StockHomeScreen />);

  expect(groupTitles()).toEqual(['Pantry', 'Fridge']);
  expect(itemIds(within(screen.getByTestId('stock-group-Fridge')))).toEqual(['milk', 'yogurt']);
  expect(screen.getByLabelText('Fridge, 2 items')).toBeTruthy();
  expect(screen.getByTestId('group-by-place').props.accessibilityState).toEqual({ selected: true });

  await fireEvent.press(screen.getByTestId('group-by-place'));
  expect(mockUpdateSettings).toHaveBeenLastCalledWith({ stockGroupBy: 'none' });
});

it('groups by store, with an item under each store that sells it', async () => {
  mockSettings.current = { ...DEFAULT_SETTINGS, stockGroupBy: 'store' };
  await render(<StockHomeScreen />);

  expect(groupTitles()).toEqual(['Market', 'Supermarket']);
  expect(itemIds(within(screen.getByTestId('stock-group-Market')))).toEqual(['rice']);
  expect(itemIds(within(screen.getByTestId('stock-group-Supermarket')))).toEqual(['milk', 'rice', 'yogurt']);
  expect(screen.getByText('3 of 3')).toBeTruthy();
});

it('groups only what your search finds', async () => {
  mockSettings.current = { ...DEFAULT_SETTINGS, stockGroupBy: 'place' };
  await render(<StockHomeScreen />);

  await fireEvent.changeText(screen.getByTestId('stock-search-input'), 'rice');

  expect(groupTitles()).toEqual(['Pantry']);
  expect(itemIds()).toEqual(['rice']);
});
