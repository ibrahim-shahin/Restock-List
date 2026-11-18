import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import StockCheckScreen from '@/app/stock-check';
import type { StockItem } from '@/state/StockContext';

const mockCreateBuyList = jest.fn();
let mockItems: StockItem[] = [];
const defaultItems: StockItem[] = [
  { id: 'milk', name: 'Milk', minimumQuantity: 1, restockQuantity: 2, unit: 'L', location: 'Fridge', storeTypes: ['Supermarket'], createdAt: 1 },
  { id: 'bread', name: 'Bread', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Pantry', storeTypes: ['Supermarket'], createdAt: 2 },
];

const mockPlaceOrder = { current: [] as string[] };
jest.mock('@/state/Settings', () => ({
  useSettings: () => ({ settings: { placeOrder: mockPlaceOrder.current } }),
}));
jest.mock('@/state/StockContext', () => ({
  useStock: () => ({ items: mockItems, createBuyList: mockCreateBuyList }),
}));
const mockFocus = { current: true };
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismissTo: jest.fn(), push: jest.fn() },
  useIsFocused: () => mockFocus.current,
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

async function startCheck() {
  await render(<StockCheckScreen />);
  await fireEvent.press(screen.getByTestId('choose-store-Supermarket'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockItems = defaultItems;
  mockPlaceOrder.current = [];
  mockFocus.current = true;
});

it('keeps the Previous item space on the first item, so Yes and No stay put', async () => {
  await startCheck();

  // Invisible and hidden from screen readers, but still taking up its space.
  expect(screen.queryByTestId('previous-item-button')).toBeNull();
  const hiddenButton = screen.getByTestId('previous-item-button', { includeHiddenElements: true });
  expect(StyleSheet.flatten(hiddenButton.props.style).opacity).toBe(0);
  expect(hiddenButton.props.accessibilityState).toEqual({ disabled: true });
  await fireEvent.press(hiddenButton);
  expect(screen.getByText('Milk')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('stock-answer-yes'));
  const shownButton = screen.getByTestId('previous-item-button');
  expect(StyleSheet.flatten(shownButton.props.style).opacity).toBeUndefined();
  expect(shownButton.props.accessibilityState).toEqual({ disabled: false });

  // Yes and No sit below the scrolling question, so a longer question can't push them.
  const question = within(screen.getByTestId('check-scroll'));
  expect(question.getByText('Bread')).toBeTruthy();
  // The pinned Yes button repeats the minimum, so it's visible even if the question scrolls.
  expect(screen.getByTestId('stock-answer-yes')).toHaveTextContent(/Yes, I have at least 1(\D|$)/);
  expect(question.queryByTestId('stock-answer-yes')).toBeNull();
  expect(question.queryByTestId('stock-answer-no')).toBeNull();
});

it('goes back to the previous item and lets you change the answer', async () => {
  await startCheck();
  expect(screen.getByText('Milk')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('stock-answer-no'));
  expect(screen.getByText('Bread')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('previous-item-button'));
  expect(screen.getByText('Milk')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('stock-answer-yes'));
  await fireEvent.press(screen.getByTestId('stock-answer-no'));

  expect(mockCreateBuyList).toHaveBeenCalledTimes(1);
  expect(mockCreateBuyList).toHaveBeenCalledWith(['bread'], 'Supermarket');
});

it('changes the last answer from the result and rebuilds the buy list', async () => {
  await startCheck();
  await fireEvent.press(screen.getByTestId('stock-answer-yes'));
  await fireEvent.press(screen.getByTestId('stock-answer-no'));
  expect(mockCreateBuyList).toHaveBeenLastCalledWith(['bread'], 'Supermarket');

  await fireEvent.press(screen.getByTestId('change-last-answer-button'));
  expect(screen.getByText('Bread')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('stock-answer-yes'));

  expect(mockCreateBuyList).toHaveBeenLastCalledWith([], 'Supermarket');
});

function captureBackListeners() {
  type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
  const listeners: BackListener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler);
    return { remove: () => listeners.splice(listeners.indexOf(handler), 1) };
  });
  const pressBack = () =>
    act(() => listeners[listeners.length - 1]?.({} as Parameters<BackListener>[0]));
  return { listeners, pressBack };
}

it("returns to the store list with one press of Android's back button", async () => {
  const { listeners, pressBack } = captureBackListeners();

  await startCheck();
  await fireEvent.press(screen.getByTestId('stock-answer-no'));
  expect(screen.getByText('Bread')).toBeTruthy();

  await pressBack();

  expect(screen.getByText('Where are you going?')).toBeTruthy();
  expect(listeners).toHaveLength(0);
  expect(mockCreateBuyList).not.toHaveBeenCalled();
});

it("leaves the back button alone while another screen is on top", async () => {
  const { listeners } = captureBackListeners();
  mockFocus.current = false;

  await startCheck();

  expect(listeners).toHaveLength(0);
});

it('checks one storage place at a time and says where to go next', async () => {
  const item = (id: string, name: string, location: string): StockItem => ({
    id, name, minimumQuantity: 1, restockQuantity: 1, unit: '', location, storeTypes: ['Supermarket'], createdAt: 1,
  });
  mockItems = [
    item('yogurt', 'Yogurt', 'Fridge'),
    item('rice', 'Rice', 'Pantry'),
    item('milk', 'Milk', 'fridge'),
  ];
  await startCheck();

  expect(screen.getByText('Milk')).toBeTruthy();
  expect(screen.getByTestId('check-place')).toHaveTextContent(/1 of 2/);
  expect(screen.queryByTestId('next-place')).toBeNull();

  await fireEvent.press(screen.getByTestId('stock-answer-yes'));
  expect(screen.getByText('Yogurt')).toBeTruthy();
  expect(screen.getByTestId('check-place')).toHaveTextContent(/2 of 2/);
  expect(screen.getByTestId('next-place')).toHaveTextContent(/Next: Pantry$/);

  await fireEvent.press(screen.getByTestId('stock-answer-no'));
  expect(screen.getByText('Rice')).toBeTruthy();
  expect(screen.getByTestId('check-place')).toHaveTextContent(/Pantry.*1 of 1/);
  await fireEvent.press(screen.getByTestId('stock-answer-no'));

  expect(mockCreateBuyList).toHaveBeenCalledWith(['yogurt', 'rice'], 'Supermarket');
});

it('follows your route through the home', async () => {
  mockPlaceOrder.current = ['Pantry', 'Fridge'];

  await startCheck();

  expect(screen.getByText('Bread')).toBeTruthy();
  expect(screen.getByTestId('next-place')).toHaveTextContent(/Next: Fridge$/);
});
