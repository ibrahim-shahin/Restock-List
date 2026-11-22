import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import StockHomeScreen from '@/app/(tabs)/index';
import type { BuyListItem, StockItem } from '@/state/StockContext';

const milk: StockItem = {
  id: 'milk', name: 'Milk', minimumQuantity: 1, restockQuantity: 2, unit: 'L', location: 'Fridge',
  storeTypes: ['Supermarket'], createdAt: 2,
};
const bread: StockItem = {
  id: 'bread', name: 'Bread', unit: '', location: 'Pantry', storeTypes: ['Supermarket', 'Bakery'], createdAt: 1,
};
function entry(item: StockItem, store: string, extra: Partial<BuyListItem> = {}): BuyListItem {
  return { ...item, entryId: JSON.stringify([item.id, store]), shoppingStoreType: store, purchased: false, ...extra };
}

const mockAddToBuyList = jest.fn((_itemId: string, _store: string) => true);
const mockList = { current: [] as BuyListItem[] };
jest.mock('@/state/StockContext', () => ({
  useStock: () => ({
    items: [milk, bread],
    shoppingList: mockList.current,
    isLoading: false,
    storageError: null,
    loadProblem: null,
    loadNotice: null,
    addToBuyList: mockAddToBuyList,
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

beforeEach(() => {
  jest.clearAllMocks();
  mockList.current = [];
});

it('adds an item sold at one store with one tap', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  await render(<StockHomeScreen />);
  const button = screen.getByTestId('add-to-buy-list-milk');
  expect(button.props.accessibilityLabel).toBe('Add Milk to the buy list');

  await fireEvent.press(button);

  expect(mockAddToBuyList).toHaveBeenCalledWith('milk', 'Supermarket');
  expect(announce).toHaveBeenCalledWith('Added Milk to the buy list.');
  expect(router.push).not.toHaveBeenCalled();
});

it('asks which store when the item is sold at more than one', async () => {
  await render(<StockHomeScreen />);
  expect(screen.queryByTestId('choose-store-for-bread')).toBeNull();

  await fireEvent.press(screen.getByTestId('add-to-buy-list-bread'));
  expect(screen.getByTestId('choose-store-for-bread')).toBeTruthy();
  expect(mockAddToBuyList).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId('add-to-buy-list-bread-Bakery'));
  expect(mockAddToBuyList).toHaveBeenCalledWith('bread', 'Bakery');
  expect(screen.queryByTestId('choose-store-for-bread')).toBeNull();
});

it('shows what is already on the buy list, and offers the other stores', async () => {
  mockList.current = [entry(milk, 'Supermarket'), entry(bread, 'Supermarket')];
  await render(<StockHomeScreen />);

  const milkButton = screen.getByTestId('add-to-buy-list-milk');
  expect(milkButton.props.accessibilityLabel).toBe('Milk is on the buy list');
  expect(milkButton.props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(milkButton);
  expect(mockAddToBuyList).not.toHaveBeenCalled();

  const breadButton = screen.getByTestId('add-to-buy-list-bread');
  expect(breadButton.props.accessibilityLabel).toBe(
    'Bread is on the buy list for Supermarket. Add it for another store',
  );
  await fireEvent.press(breadButton);
  expect(screen.getByTestId('add-to-buy-list-bread-Supermarket').props.accessibilityState).toEqual({ disabled: true });
  await fireEvent.press(screen.getByTestId('add-to-buy-list-bread-Bakery'));
  expect(mockAddToBuyList).toHaveBeenCalledWith('bread', 'Bakery');
});

it('does not count ticked-off or one-time entries as on the list', async () => {
  mockList.current = [
    entry(milk, 'Supermarket', { purchased: true }),
    { ...entry(milk, 'Supermarket'), id: 'once-1', entryId: '["once-1","Supermarket"]', oneTime: true },
  ];
  await render(<StockHomeScreen />);

  expect(screen.getByTestId('add-to-buy-list-milk').props.accessibilityLabel).toBe('Add Milk to the buy list');
});

it('still opens the item to edit, and shows the minimum only when there is one', async () => {
  await render(<StockHomeScreen />);

  expect(screen.getByTestId('minimum-milk')).toHaveTextContent('1min');
  expect(screen.queryByTestId('minimum-bread')).toBeNull();

  await fireEvent.press(screen.getByTestId('stock-item-milk'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/item-form', params: { itemId: 'milk' } });
});
