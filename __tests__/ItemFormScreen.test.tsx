import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
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
