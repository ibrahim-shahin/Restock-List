import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import StockHomeScreen from '@/app/(tabs)/index';
import type { StockItem } from '@/state/StockContext';

function mockItem(id: string, name: string, location: string): StockItem {
  return { id, name, minimumQuantity: 1, restockQuantity: 1, unit: '', location, storeTypes: ['Supermarket'], createdAt: 1 };
}

const mockItems = [
  mockItem('milk', 'Milk', 'Fridge'),
  mockItem('rice', 'Rice', 'Pantry'),
  mockItem('yogurt', 'Yogurt', 'Fridge'),
];

jest.mock('@/state/StockContext', () => ({
  useStock: () => ({
    items: mockItems,
    shoppingList: [],
    isLoading: false,
    storageError: null,
    loadProblem: null,
    loadNotice: null,
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

function visibleItemIds() {
  return screen.queryAllByTestId(/^stock-item-/).map((element) => element.props.testID);
}

it('filters the list as you type and clears again', async () => {
  await render(<StockHomeScreen />);
  expect(visibleItemIds()).toHaveLength(3);

  await fireEvent.changeText(screen.getByTestId('stock-search-input'), 'fridge');
  expect(visibleItemIds().sort()).toEqual(['stock-item-milk', 'stock-item-yogurt']);

  await fireEvent.press(screen.getByTestId('clear-search-button'));
  expect(visibleItemIds()).toHaveLength(3);
});

it('says so when nothing matches', async () => {
  await render(<StockHomeScreen />);

  await fireEvent.changeText(screen.getByTestId('stock-search-input'), 'batteries');

  expect(visibleItemIds()).toHaveLength(0);
  expect(screen.getByText('No items match your search')).toBeTruthy();
});
