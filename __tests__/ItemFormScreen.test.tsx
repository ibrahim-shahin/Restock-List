import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import { KeyboardController } from 'react-native-keyboard-controller';
import ItemFormScreen from '@/app/item-form';

const mockSaveItem = jest.fn((_draft: unknown, _id?: string) => 'saved');

jest.mock('@/state/StockContext', () => ({
  useStock: () => ({
    items: [],
    recentLocations: ['Fridge'],
    recentStores: ['Supermarket'],
    isLoading: false,
    saveItem: mockSaveItem,
    deleteItem: jest.fn(),
  }),
}));
const mockPrices = {
  current: { showPrices: false, currency: '' } as { showPrices: boolean; currency: string; priceDecimals?: 2 | 3 },
};
jest.mock('@/state/Settings', () => ({
  useSettings: () => ({ settings: mockPrices.current }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@/components/KeyboardAwareScrollViewCompat', () => ({
  KeyboardAwareScrollViewCompat: jest.requireActual('react-native').ScrollView,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

async function fillInMilk() {
  await fireEvent.changeText(screen.getByTestId('item-name-input'), 'Milk');
  await fireEvent.changeText(screen.getByTestId('minimum-quantity-input'), '1');
  await fireEvent.changeText(screen.getByTestId('restock-quantity-input'), '2');
  await fireEvent.changeText(screen.getByTestId('item-location-input'), 'Fridge');
  await fireEvent.changeText(screen.getByTestId('item-store-input'), 'Supermarket');
  await fireEvent(screen.getByTestId('item-store-input'), 'submitEditing');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrices.current = { showPrices: false, currency: '' };
});

it('picks an icon from the name until you choose one', async () => {
  await render(<ItemFormScreen />);
  expect(screen.getByTestId('item-emoji-button')).toHaveTextContent('📦');

  await fillInMilk();
  expect(screen.getByTestId('item-emoji-button')).toHaveTextContent('🥛');

  await fireEvent.press(screen.getByTestId('save-item-button'));
  expect(mockSaveItem).toHaveBeenCalledWith(expect.not.objectContaining({ emoji: expect.anything() }), undefined);
});

it('saves the icon you choose', async () => {
  await render(<ItemFormScreen />);
  await fillInMilk();

  await fireEvent.press(screen.getByTestId('item-emoji-button'));
  await fireEvent.press(screen.getByTestId('emoji-choice-🧃'));

  expect(screen.queryByTestId('item-emoji-picker')).toBeNull();
  expect(screen.getByTestId('item-emoji-button')).toHaveTextContent('🧃');
  await fireEvent.press(screen.getByTestId('save-item-button'));
  expect(mockSaveItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Milk', emoji: '🧃' }), undefined);
});

it('saves a note with the item', async () => {
  await render(<ItemFormScreen />);
  await fillInMilk();

  await fireEvent.changeText(screen.getByTestId('item-note-input'), '  Full fat, 2 L  ');
  await fireEvent.press(screen.getByTestId('save-item-button'));

  expect(mockSaveItem).toHaveBeenCalledWith(expect.objectContaining({ note: 'Full fat, 2 L' }), undefined);
});

it('goes back to picking from the name', async () => {
  await render(<ItemFormScreen />);
  await fillInMilk();
  await fireEvent.press(screen.getByTestId('item-emoji-button'));
  await fireEvent.press(screen.getByTestId('emoji-choice-🧃'));

  await fireEvent.press(screen.getByTestId('item-emoji-auto'));

  expect(screen.getByTestId('item-emoji-button')).toHaveTextContent('🥛');
});

it('asks for a price only when prices are turned on', async () => {
  await render(<ItemFormScreen />);
  expect(screen.queryByTestId('item-price-input')).toBeNull();
});

it('saves the price you enter', async () => {
  mockPrices.current = { showPrices: true, currency: 'JD' };
  await render(<ItemFormScreen />);
  await fillInMilk();
  expect(screen.getByText('PRICE EACH (OPTIONAL, JD)')).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('item-price-input'), '1,256');
  expect(screen.getByTestId('item-price-input').props.value).toBe('1.25');
  await fireEvent.press(screen.getByTestId('save-item-button'));

  expect(mockSaveItem).toHaveBeenCalledWith(expect.objectContaining({ price: 1.25 }), undefined);
});

it('takes three decimals for currencies like the dinar', async () => {
  mockPrices.current = { showPrices: true, currency: 'JD', priceDecimals: 3 };
  await render(<ItemFormScreen />);
  await fillInMilk();

  await fireEvent.changeText(screen.getByTestId('item-price-input'), '0,3756');
  expect(screen.getByTestId('item-price-input').props.value).toBe('0.375');
  await fireEvent.press(screen.getByTestId('save-item-button'));

  expect(mockSaveItem).toHaveBeenCalledWith(expect.objectContaining({ price: 0.375 }), undefined);
});

describe('closing', () => {
  it('waits for the keyboard to finish hiding, then closes once', async () => {
    let keyboardHidden: () => void = () => undefined;
    jest.mocked(KeyboardController.dismiss).mockImplementationOnce(
      () => new Promise<void>((resolve) => (keyboardHidden = resolve)),
    );
    await render(<ItemFormScreen />);
    await fillInMilk();

    await fireEvent.press(screen.getByTestId('save-item-button'));
    await fireEvent.press(screen.getByTestId('save-item-button'));
    await fireEvent.press(screen.getByTestId('close-item-form'));
    expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();

    keyboardHidden();
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(mockSaveItem).toHaveBeenCalledTimes(1);
  });

  it('closes without saving from the close button', async () => {
    await render(<ItemFormScreen />);

    await fireEvent.press(screen.getByTestId('close-item-form'));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(mockSaveItem).not.toHaveBeenCalled();
  });

  it('stays open when the name is already taken', async () => {
    mockSaveItem.mockReturnValueOnce(null as never);
    await render(<ItemFormScreen />);
    await fillInMilk();

    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(screen.getByText('An item with this name is already in your stock. Try another name.')).toBeTruthy();
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });
});
