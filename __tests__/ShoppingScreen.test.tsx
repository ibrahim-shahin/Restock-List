import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import { AccessibilityInfo, Share } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import ShoppingListScreen from '@/app/(tabs)/shopping';
import type { BuyListItem } from '@/state/StockContext';

const mockRestore = jest.fn();
const mockRemoveFromBuyList = jest.fn((_entryId: string): (() => void) | null => mockRestore);
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
const mockFocused = { current: true };
const mockKeepScreenOn = { current: false };
const mockPrices = {
  current: { showPrices: false, currency: '' } as { showPrices: boolean; currency: string; priceDecimals?: 2 | 3 },
};
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => mockFocused.current }));
jest.mock('@/state/Settings', () => ({
  useSettings: () => ({ settings: { keepScreenOn: mockKeepScreenOn.current, ...mockPrices.current } }),
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused.current = true;
  mockKeepScreenOn.current = false;
  mockPrices.current = { showPrices: false, currency: '' };
  milk.price = 1.25;
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

describe('keeping the screen on', () => {
  it('keeps it on while the buy list is open, when that is switched on', async () => {
    mockKeepScreenOn.current = true;
    const { unmount } = await render(<ShoppingListScreen />);

    expect(activateKeepAwakeAsync).toHaveBeenCalledWith('home-stock-buy-list');
    await unmount();
    expect(deactivateKeepAwake).toHaveBeenCalledWith('home-stock-buy-list');
  });

  it('leaves the screen alone when switched off or when another tab is showing', async () => {
    await render(<ShoppingListScreen />);
    mockKeepScreenOn.current = true;
    mockFocused.current = false;
    await render(<ShoppingListScreen />);

    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
  });
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

describe('undo after removing a one-time item', () => {
  it('offers to put it back, and does', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<ShoppingListScreen />);

    await fireEvent.press(screen.getByTestId('remove-buy-item-once-1'));
    expect(screen.getByTestId('undo-bar')).toHaveTextContent(/Removed Birthday candles/);
    expect(screen.getByTestId('undo-remove-button').props.accessibilityLabel).toBe(
      'Undo removing Birthday candles',
    );
    expect(announce).toHaveBeenCalledWith('Removed Birthday candles. Undo is available.');

    await fireEvent.press(screen.getByTestId('undo-remove-button'));
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('undo-bar')).toBeNull();
  });

  it('goes away by itself after a few seconds', async () => {
    jest.useFakeTimers();
    await render(<ShoppingListScreen />);
    await fireEvent.press(screen.getByTestId('remove-buy-item-once-1'));

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.getByTestId('undo-bar')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId('undo-bar')).toBeNull();
    expect(mockRestore).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('stays until it is used while a screen reader is on', async () => {
    jest.useFakeTimers();
    const screenReader = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await render(<ShoppingListScreen />);
    await fireEvent.press(screen.getByTestId('remove-buy-item-once-1'));

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId('undo-bar')).toBeTruthy();
    screenReader.mockRestore();
    jest.useRealTimers();
  });
});

describe('prices', () => {
  it('stay hidden until prices are turned on', async () => {
    await render(<ShoppingListScreen />);

    expect(screen.queryByTestId('buy-price-milk')).toBeNull();
    expect(screen.queryByTestId('trip-estimate')).toBeNull();
  });

  it('show each line, the store subtotal and what is left to spend', async () => {
    mockPrices.current = { showPrices: true, currency: 'JD' };
    await render(<ShoppingListScreen />);

    expect(screen.getByTestId('buy-price-milk')).toHaveTextContent('2.50 JD');
    expect(screen.queryByTestId('buy-price-once-1')).toBeNull();
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent(
      'About 2.50 JD still to spend (1 item has no price)',
    );
    expect(screen.getByText('2.50 JD · 2')).toBeTruthy();
  });

  it('are included when you share the list', async () => {
    mockPrices.current = { showPrices: true, currency: 'JD' };
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await render(<ShoppingListScreen />);

    await fireEvent.press(screen.getByTestId('share-buy-list-button'));

    const { message } = share.mock.calls[0][0] as { message: string };
    expect(message).toContain('• Milk — 2 L, 2.50 JD (Fridge) — Full fat');
    expect(message).toContain('About 2.50 JD still to spend (1 item has no price)');
  });

  it('show three decimals for currencies like the dinar', async () => {
    mockPrices.current = { showPrices: true, currency: 'JD', priceDecimals: 3 };
    await render(<ShoppingListScreen />);

    expect(screen.getByTestId('buy-price-milk')).toHaveTextContent('2.500 JD');
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent(/^About 2\.500 JD still to spend/);
  });
});
