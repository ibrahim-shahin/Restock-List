import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import { Share } from 'react-native';
import ShoppingListScreen from '@/app/(tabs)/shopping';
import type { BuyListItem } from '@/state/StockContext';

const mockRemoveFromBuyList = jest.fn();
const mockTogglePurchased = jest.fn();
const milk: BuyListItem = {
  id: 'milk', name: 'Milk', minimumQuantity: 1, restockQuantity: 2, unit: 'L', location: 'Fridge',
  storeTypes: ['Supermarket'], createdAt: 1, entryId: '["milk","Supermarket"]', shoppingStoreType: 'Supermarket', purchased: false,
  note: 'Full fat',
};
const candles: BuyListItem = {
  id: 'once-1', name: 'Birthday candles', minimumQuantity: 0, restockQuantity: 2, unit: 'packs', location: '',
  storeTypes: ['Supermarket'], createdAt: 2, entryId: '["once-1","Supermarket"]', shoppingStoreType: 'Supermarket',
  purchased: false, oneTime: true,
};

jest.mock('@/state/StockContext', () => ({
  useStock: () => ({
    shoppingList: [milk, candles],
    items: [],
    togglePurchased: mockTogglePurchased,
    clearPurchased: jest.fn(),
    removeFromBuyList: mockRemoveFromBuyList,
  }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('marks one-time items and lets you remove them', async () => {
  await render(<ShoppingListScreen />);

  expect(screen.getByText('Just this once')).toBeTruthy();
  expect(screen.queryByTestId('remove-buy-item-milk')).toBeNull();

  await fireEvent.press(screen.getByTestId('remove-buy-item-once-1'));
  expect(mockRemoveFromBuyList).toHaveBeenCalledWith('["once-1","Supermarket"]');
  expect(mockTogglePurchased).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId('buy-item-once-1'));
  expect(mockTogglePurchased).toHaveBeenCalledWith('["once-1","Supermarket"]');
});

it('opens the one-time item form, for a store or in general', async () => {
  await render(<ShoppingListScreen />);

  await fireEvent.press(screen.getByTestId('add-one-time-item-button'));
  expect(router.push).toHaveBeenLastCalledWith('/one-time-item');

  await fireEvent.press(screen.getByTestId('add-one-time-item-Supermarket'));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/one-time-item', params: { store: 'Supermarket' } });
});

it('shares one-time items without a storage place', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await render(<ShoppingListScreen />);

  await fireEvent.press(screen.getByTestId('share-buy-list-button'));

  const message = share.mock.calls[0][0] as { message: string };
  expect(message.message).toContain('• Milk — 2 L (Fridge) — Full fat');
  expect(message.message).toContain('• Birthday candles — 2 packs');
  expect(message.message).not.toContain('Birthday candles — 2 packs (');
});

it('shows notes under the item name', async () => {
  await render(<ShoppingListScreen />);

  expect(screen.getByTestId('buy-note-milk')).toHaveTextContent('Full fat');
  expect(screen.queryByTestId('buy-note-once-1')).toBeNull();
});

it('reads the amount, note and place to screen readers', async () => {
  await render(<ShoppingListScreen />);

  expect(screen.getByTestId('buy-item-milk').props.accessibilityLabel).toBe(
    'Mark purchased: Milk, 2 L, Full fat, Fridge',
  );
  expect(screen.getByTestId('buy-item-once-1').props.accessibilityLabel).toBe(
    'Mark purchased: Birthday candles, 2 packs, just this once',
  );
});
