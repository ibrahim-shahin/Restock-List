import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import OneTimeItemScreen from '@/app/one-time-item';

const mockAddOneTimeItem = jest.fn((_draft: unknown): string | null => null);
const mockParams = { current: {} as { store?: string } };
const mockStores = { current: ['Supermarket', 'Bakery'] };

jest.mock('@/state/StockContext', () => ({
  useStock: () => ({
    items: mockStores.current.map((store, index) => ({
      id: `item${index}`,
      name: `Item ${index}`,
      minimumQuantity: 1,
      restockQuantity: 1,
      unit: '',
      location: 'Pantry',
      storeTypes: [store],
      createdAt: 1,
    })),
    shoppingList: [],
    recentStores: [],
    isLoading: false,
    addOneTimeItem: mockAddOneTimeItem,
  }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock('@/components/KeyboardAwareScrollViewCompat', () => ({
  KeyboardAwareScrollViewCompat: jest.requireActual('react-native').ScrollView,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
  mockStores.current = ['Supermarket', 'Bakery'];
});

it('adds the item for the store it was opened from, then closes', async () => {
  mockParams.current = { store: 'Bakery' };
  await render(<OneTimeItemScreen />);

  await fireEvent.changeText(screen.getByTestId('one-time-name-input'), 'Birthday candles');
  await fireEvent.changeText(screen.getByTestId('one-time-quantity-input'), '3');
  await fireEvent.changeText(screen.getByTestId('one-time-unit-input'), 'packs');
  await fireEvent.changeText(screen.getByTestId('one-time-note-input'), 'Number shapes');
  await fireEvent.press(screen.getByTestId('save-one-time-item'));

  expect(mockAddOneTimeItem).toHaveBeenCalledWith({
    name: 'Birthday candles',
    quantity: 3,
    unit: 'packs',
    store: 'Bakery',
    note: 'Number shapes',
  });
  expect(router.back).toHaveBeenCalled();
});

it('lets you pick a store or type a new one', async () => {
  await render(<OneTimeItemScreen />);
  await fireEvent.changeText(screen.getByTestId('one-time-name-input'), 'Plasters');

  await fireEvent.press(screen.getByTestId('one-time-store-Supermarket'));
  await fireEvent.press(screen.getByTestId('save-one-time-item'));
  expect(mockAddOneTimeItem).toHaveBeenLastCalledWith(expect.objectContaining({ store: 'Supermarket', quantity: 1 }));

  await fireEvent.changeText(screen.getByTestId('one-time-store-input'), 'Pharmacy');
  await fireEvent.press(screen.getByTestId('save-one-time-item'));
  expect(mockAddOneTimeItem).toHaveBeenLastCalledWith(expect.objectContaining({ store: 'Pharmacy' }));
});

it('picks the only store there is', async () => {
  mockStores.current = ['Supermarket'];
  await render(<OneTimeItemScreen />);

  await fireEvent.changeText(screen.getByTestId('one-time-name-input'), 'Foil');
  await fireEvent.press(screen.getByTestId('save-one-time-item'));

  expect(mockAddOneTimeItem).toHaveBeenCalledWith(expect.objectContaining({ store: 'Supermarket' }));
});

it('stays open and says what to fix', async () => {
  mockAddOneTimeItem.mockReturnValueOnce('Choose where you will buy it.');
  await render(<OneTimeItemScreen />);

  await fireEvent.changeText(screen.getByTestId('one-time-name-input'), 'Foil');
  await fireEvent.press(screen.getByTestId('save-one-time-item'));

  expect(screen.getByText('Choose where you will buy it.')).toBeTruthy();
  expect(router.back).not.toHaveBeenCalled();
});

it('saves the store you type, even when it starts with the name of a store you know', async () => {
  await render(<OneTimeItemScreen />);
  await fireEvent.changeText(screen.getByTestId('one-time-name-input'), 'Foil');

  await fireEvent.changeText(screen.getByTestId('one-time-store-input'), 'Bakery');
  // The field must keep the text: if it cleared, the next letters would start a new store name.
  expect(screen.getByTestId('one-time-store-input').props.value).toBe('Bakery');
  await fireEvent.changeText(screen.getByTestId('one-time-store-input'), 'Bakery Corner');
  await fireEvent.press(screen.getByTestId('save-one-time-item'));

  expect(mockAddOneTimeItem).toHaveBeenCalledWith(expect.objectContaining({ store: 'Bakery Corner' }));
});

it('uses the first store when a link repeats it', async () => {
  mockParams.current = { store: ['Bakery', 'Supermarket'] } as never;
  await render(<OneTimeItemScreen />);

  await fireEvent.changeText(screen.getByTestId('one-time-name-input'), 'Foil');
  await fireEvent.press(screen.getByTestId('save-one-time-item'));

  expect(mockAddOneTimeItem).toHaveBeenCalledWith(expect.objectContaining({ store: 'Bakery' }));
});
