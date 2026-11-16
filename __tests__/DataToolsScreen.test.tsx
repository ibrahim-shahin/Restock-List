import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import DataToolsScreen from '@/app/data-tools';
import { shareBackupFile } from '@/utils/backup';

const mockMarkBackedUp = jest.fn();
const mockStock = {
  current: {
    items: [{ id: 'milk', name: 'Milk', minimumQuantity: 1, restockQuantity: 2, unit: 'L', location: 'Fridge', storeTypes: ['Supermarket'], createdAt: 1 }],
    shoppingList: [],
    recentLocations: ['Fridge'],
    recentStores: ['Supermarket'],
    importBackup: jest.fn(),
    isLoading: false,
    loadProblem: null as string | null,
    loadNotice: null as string | null,
    savedCopyCount: 0,
    dismissLoadNotice: jest.fn(),
    retryLoad: jest.fn(),
    startFresh: jest.fn(() => Promise.resolve()),
    getRecoveryData: jest.fn(() => Promise.resolve('{}')),
    deleteSavedCopies: jest.fn(() => Promise.resolve()),
  },
};

jest.mock('@/state/StockContext', () => ({ useStock: () => mockStock.current }));
jest.mock('@/state/BackupStatus', () => ({
  useBackupStatus: () => ({ lastBackupAt: null, checkedAt: 1, markBackedUp: mockMarkBackedUp }),
}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('@/utils/backup', () => ({
  ...jest.requireActual('@/utils/backup'),
  shareBackupFile: jest.fn(() => Promise.resolve()),
  shareTextFile: jest.fn(() => Promise.resolve()),
  pickBackupFile: jest.fn(() => Promise.resolve({ canceled: true })),
}));
jest.mock('@/components/KeyboardAwareScrollViewCompat', () => ({
  KeyboardAwareScrollViewCompat: jest.requireActual('react-native').ScrollView,
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let alerts: { title: string; buttons?: AlertButton[] }[] = [];

function pressAlertButton(title: string, button: string) {
  const alert = alerts.find((candidate) => candidate.title === title);
  if (!alert) throw new Error(`No "${title}" alert was shown.`);
  alert.buttons?.find((candidate) => candidate.text === button)?.onPress?.();
}

beforeEach(() => {
  jest.clearAllMocks();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
    alerts.push({ title, buttons });
  });
});

describe('saving a backup', () => {
  it('records the backup only after you confirm it was saved', async () => {
    await render(<DataToolsScreen />);

    await fireEvent.press(screen.getByTestId('export-file-button'));

    await waitFor(() => expect(alerts.map((alert) => alert.title)).toContain('Did the backup save?'));
    expect(shareBackupFile).toHaveBeenCalledTimes(1);
    expect(mockMarkBackedUp).not.toHaveBeenCalled();

    pressAlertButton('Did the backup save?', "Yes, it's saved");
    expect(mockMarkBackedUp).toHaveBeenCalledTimes(1);
  });

  it("doesn't record a backup you say wasn't saved", async () => {
    await render(<DataToolsScreen />);

    await fireEvent.press(screen.getByTestId('export-file-button'));
    await waitFor(() => expect(alerts).toHaveLength(1));
    pressAlertButton('Did the backup save?', 'Not yet');

    expect(mockMarkBackedUp).not.toHaveBeenCalled();
  });

  it("doesn't ask when the backup file couldn't be shared", async () => {
    (shareBackupFile as jest.Mock).mockRejectedValueOnce(new Error('no share sheet'));
    await render(<DataToolsScreen />);

    await fireEvent.press(screen.getByTestId('export-file-button'));

    await waitFor(() => expect(alerts.map((alert) => alert.title)).toEqual(['Could not save the backup']));
    expect(mockMarkBackedUp).not.toHaveBeenCalled();
  });
});
