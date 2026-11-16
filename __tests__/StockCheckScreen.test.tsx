import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { BackHandler } from 'react-native';
import StockCheckScreen from '@/app/stock-check';
import type { StockItem } from '@/state/StockContext';

const mockCreateBuyList = jest.fn();
const mockItems: StockItem[] = [
  { id: 'milk', name: 'Milk', minimumQuantity: 1, restockQuantity: 2, unit: 'L', location: 'Fridge', storeTypes: ['Supermarket'], createdAt: 1 },
  { id: 'bread', name: 'Bread', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Pantry', storeTypes: ['Supermarket'], createdAt: 2 },
];

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
  mockFocus.current = true;
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
