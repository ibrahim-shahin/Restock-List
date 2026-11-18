import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import CheckRouteScreen from '@/app/check-route';

const mockUpdateSettings = jest.fn();
const mockPlaceOrder = { current: [] as string[] };

jest.mock('@/state/Settings', () => ({
  useSettings: () => ({ settings: { placeOrder: mockPlaceOrder.current }, updateSettings: mockUpdateSettings }),
}));
jest.mock('@/state/StockContext', () => ({
  useStock: () => ({
    items: ['Pantry', 'Fridge', 'fridge', 'Bathroom'].map((location) => ({ location })),
  }),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function placesShown() {
  return [0, 1, 2].map((index) => screen.getByTestId(`route-place-${index}`));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlaceOrder.current = [];
});

it('lists each storage place once, A to Z until you change it', async () => {
  await render(<CheckRouteScreen />);

  expect(placesShown()).toHaveLength(3);
  expect(placesShown()[0]).toHaveTextContent(/Bathroom/);
  expect(placesShown()[2]).toHaveTextContent(/Pantry/);
  expect(screen.queryByTestId('route-place-3')).toBeNull();
  expect(screen.queryByTestId('reset-route-button')).toBeNull();
});

it('saves the whole order when you move a place', async () => {
  await render(<CheckRouteScreen />);

  await fireEvent.press(screen.getByTestId('move-up-2'));

  expect(mockUpdateSettings).toHaveBeenCalledWith({ placeOrder: ['Bathroom', 'Pantry', 'Fridge'] });
});

it('follows a saved route and can go back to A to Z', async () => {
  mockPlaceOrder.current = ['Pantry', 'Fridge', 'Bathroom'];
  await render(<CheckRouteScreen />);
  expect(placesShown()[0]).toHaveTextContent(/Pantry/);

  await fireEvent.press(screen.getByTestId('reset-route-button'));

  expect(mockUpdateSettings).toHaveBeenCalledWith({ placeOrder: [] });
});

it("can't move the first place earlier or the last one later", async () => {
  await render(<CheckRouteScreen />);

  await fireEvent.press(screen.getByTestId('move-up-0'));
  await fireEvent.press(screen.getByTestId('move-down-2'));

  expect(mockUpdateSettings).not.toHaveBeenCalled();
});
