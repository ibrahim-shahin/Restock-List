import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import DataToolsScreen from '@/app/data-tools';
import { shareBackupFile, shareTextFile } from '@/utils/backup';

const mockMarkBackedUp = jest.fn();
const mockStock = {
  current: {
    items: [{ id: 'milk', name: 'Milk', minimumQuantity: 1, restockQuantity: 2, unit: 'L', location: 'Fridge', storeTypes: ['Supermarket'], createdAt: 1 }],
    shoppingList: [],
    recentLocations: ['Fridge'],
    recentStores: ['Supermarket'],
    importBackup: jest.fn(() => ({ importedCount: 1, skippedCount: 0, shoppingListAddedCount: 0 })),
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
const mockSettings = {
  ...(jest.requireActual('@/state/Settings') as typeof import('@/state/Settings')).DEFAULT_SETTINGS,
};
const mockUpdateSettings = jest.fn();
const mockSaveReminder = jest.fn((_next: unknown) => Promise.resolve(true));
jest.mock('@/state/Settings', () => ({
  ...jest.requireActual('@/state/Settings'),
  useSettings: () => ({ settings: mockSettings, updateSettings: mockUpdateSettings, isReady: true }),
}));
jest.mock('@/state/Reminder', () => ({
  useReminder: () => ({ reminder: { enabled: true, weekday: 7, hour: 10 }, saveReminder: mockSaveReminder }),
}));
jest.mock('expo-notifications', () => ({}));
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
  mockStock.current = { ...mockStock.current, loadProblem: null, loadNotice: null, savedCopyCount: 0 };
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

describe('recovering saved stock', () => {
  it('starts fresh only after you confirm', async () => {
    mockStock.current = { ...mockStock.current, loadProblem: 'unreadable' };
    await render(<DataToolsScreen />);

    await fireEvent.press(screen.getByTestId('start-fresh-button'));
    expect(mockStock.current.startFresh).not.toHaveBeenCalled();
    pressAlertButton('Start fresh?', 'Start fresh');

    expect(mockStock.current.startFresh).toHaveBeenCalledTimes(1);
  });

  it('offers only Try again when the saved stock could not be read', async () => {
    mockStock.current = { ...mockStock.current, loadProblem: 'read-failed' };
    await render(<DataToolsScreen />);

    expect(screen.queryByTestId('start-fresh-button')).toBeNull();
    await fireEvent.press(screen.getByTestId('retry-load-button'));

    expect(mockStock.current.retryLoad).toHaveBeenCalledTimes(1);
  });

  it('keeps the saved copies reachable until you delete them', async () => {
    mockStock.current = { ...mockStock.current, savedCopyCount: 2 };
    await render(<DataToolsScreen />);
    expect(screen.getByText('Damaged saved data is kept on this phone')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('save-original-button'));
    await waitFor(() =>
      expect(shareTextFile).toHaveBeenCalledWith('home-stock-saved-copies.json', '{}', expect.any(String)),
    );

    await fireEvent.press(screen.getByTestId('delete-copies-button'));
    expect(mockStock.current.deleteSavedCopies).not.toHaveBeenCalled();
    pressAlertButton('Delete the saved copies?', 'Delete');
    expect(mockStock.current.deleteSavedCopies).toHaveBeenCalledTimes(1);
  });
});

describe('settings in backups', () => {
  const backup = (extra: Record<string, unknown>) =>
    JSON.stringify({ items: [{ name: 'Rice', minimumQuantity: 1, restockQuantity: 1, location: 'Pantry', storeTypes: ['Market'] }], shoppingList: [], ...extra });

  async function importText(text: string) {
    await render(<DataToolsScreen />);
    await fireEvent.changeText(screen.getByTestId('import-json-input'), text);
    await fireEvent.press(screen.getByTestId('import-json-button'));
  }

  it('saves your settings and weekly reminder in the backup file', async () => {
    await render(<DataToolsScreen />);

    await fireEvent.press(screen.getByTestId('export-file-button'));

    await waitFor(() => expect(shareBackupFile).toHaveBeenCalled());
    expect((shareBackupFile as jest.Mock).mock.calls[0][2]).toEqual({
      settings: mockSettings,
      reminder: { enabled: true, weekday: 7, hour: 10 },
    });
  });

  const lastAlertMessage = () => jest.mocked(Alert.alert).mock.calls.at(-1)?.[1];

  it("offers to use a backup's settings, and changes only what differs", async () => {
    await importText(backup({ settings: { ...mockSettings, theme: 'dark', colorTheme: 'ocean', placeOrder: ['Kitchen'] }, reminder: { enabled: true, weekday: 2, hour: 18 } }));

    expect(alerts.map((alert) => alert.title)).toEqual(['Import complete']);
    expect(lastAlertMessage()).toMatch(
      /different settings: theme, colours, stock check route and weekly reminder\. Use them on this phone\?$/,
    );
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    pressAlertButton('Import complete', "Use the backup's");

    expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: 'dark', colorTheme: 'ocean', placeOrder: ['Kitchen'] });
    expect(mockSaveReminder).toHaveBeenCalledWith({ enabled: true, weekday: 2, hour: 18 });
  });

  it('leaves alone what the backup lacks or has wrong, like an older backup', async () => {
    await importText(backup({ settings: { theme: 'neon', colorTheme: 'plum' }, reminder: { enabled: true, weekday: 9, hour: 10 } }));

    expect(lastAlertMessage()).toMatch(/different settings: colours\. Use them/);
    pressAlertButton('Import complete', "Use the backup's");

    expect(mockUpdateSettings).toHaveBeenCalledWith({ colorTheme: 'plum' });
    expect(mockSaveReminder).not.toHaveBeenCalled();
  });

  it("doesn't ask when the backup's settings are the same as this phone's", async () => {
    await importText(backup({ settings: mockSettings, reminder: { enabled: true, weekday: 7, hour: 10 } }));

    expect(alerts).toEqual([{ title: 'Import complete', buttons: undefined }]);
  });

  it('keeps your settings when you say so', async () => {
    await importText(backup({ settings: { theme: 'dark' } }));

    pressAlertButton('Import complete', 'Keep mine');

    expect(mockUpdateSettings).not.toHaveBeenCalled();
    expect(mockSaveReminder).not.toHaveBeenCalled();
  });

  it("doesn't ask about settings when the backup has none", async () => {
    await importText(backup({}));

    expect(alerts).toEqual([{ title: 'Import complete', buttons: undefined }]);
  });
});
