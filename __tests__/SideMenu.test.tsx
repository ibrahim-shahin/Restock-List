import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { MenuButton, SideMenuProvider } from '@/components/SideMenu';

jest.mock('@/state/StockContext', () => ({
  useStock: () => ({
    items: [{ id: 'milk' }, { id: 'rice' }],
    shoppingList: [{ purchased: false }, { purchased: true }],
  }),
}));
jest.mock('@/state/BackupStatus', () => ({
  useBackupStatus: () => ({ lastBackupAt: null, checkedAt: 1 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

async function renderWithMenu() {
  await render(
    <SideMenuProvider>
      <Text>Stock screen</Text>
      <MenuButton />
    </SideMenuProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('opens from the menu button with a summary and the links', async () => {
  await renderWithMenu();
  expect(screen.queryByTestId('side-menu')).toBeNull();

  await fireEvent.press(screen.getByTestId('open-menu-button'));

  expect(screen.getByTestId('side-menu')).toBeTruthy();
  expect(screen.getByText('2 items · 1 to buy')).toBeTruthy();
  expect(screen.getByText('Backup & restore')).toBeTruthy();
  expect(screen.getByText('No backup yet')).toBeTruthy();
  expect(screen.getByText('Settings')).toBeTruthy();
});

it.each([
  ['menu-settings', '/settings'],
  ['menu-backup', '/data-tools'],
  ['menu-check-stock', '/stock-check'],
])('closes and opens the screen for %s', async (testID, href) => {
  await renderWithMenu();
  await fireEvent.press(screen.getByTestId('open-menu-button'));

  await fireEvent.press(screen.getByTestId(testID));

  expect(router.push).toHaveBeenCalledWith(href);
  expect(screen.queryByTestId('side-menu')).toBeNull();
});

it('closes when tapping outside it', async () => {
  await renderWithMenu();
  await fireEvent.press(screen.getByTestId('open-menu-button'));

  // The panel is a screen-reader modal, which hides the backdrop from them;
  // the panel's own close button is the way out there.
  await fireEvent.press(screen.getByTestId('menu-backdrop', { includeHiddenElements: true }));

  await waitFor(() => expect(screen.queryByTestId('side-menu')).toBeNull());
  expect(router.push).not.toHaveBeenCalled();
});
