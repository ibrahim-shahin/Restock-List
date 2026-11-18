import * as Sharing from 'expo-sharing';
import type { SavedData } from '@/state/StockContext';
import {
  backupFileName,
  backupReminder,
  createBackup,
  describeLastBackup,
  hasStockData,
  pickBackupFile,
  shareBackupFile,
} from '../backup';

const mockFiles = new Map<string, string>();
const mockPickFile = jest.fn();

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}/${name}`;
    }
    create() {
      mockFiles.set(this.uri, '');
    }
    write(content: string) {
      mockFiles.set(this.uri, content);
    }
    static pickFileAsync(...args: unknown[]) {
      return mockPickFile(...args);
    }
  }
  return { File: MockFile, Paths: { cache: { uri: 'file:///cache' } } };
});

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()) }));

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 10, 16, 9, 30);

const data: SavedData = {
  items: [
    {
      id: 'milk',
      name: 'Milk',
      minimumQuantity: 1,
      restockQuantity: 2,
      unit: 'L',
      location: 'Fridge',
      storeTypes: ['Supermarket'],
      createdAt: 1,
    },
  ],
  shoppingList: [],
  recentLocations: ['Fridge'],
  recentStores: ['Supermarket'],
};

function pickedFile(text: string, size = text.length) {
  return { canceled: false, result: { size, text: () => Promise.resolve(text) } };
}

beforeEach(() => {
  mockFiles.clear();
  jest.clearAllMocks();
});

describe('backup contents', () => {
  it('wraps the stock in the Home Stock backup format', () => {
    expect(createBackup(data, now)).toEqual({
      format: 'home-stock-backup',
      version: 4,
      exportedAt: now.toISOString(),
      ...data,
    });
  });

  it('includes your settings and weekly reminder when given', () => {
    const settings = {
      backupReminderDays: 30, haptics: false, theme: 'dark', colorTheme: 'plum', placeOrder: ['Kitchen'], keepScreenOn: true,
      showPrices: true, currency: 'JD', priceDecimals: 3,
    } as const;
    const reminder = { enabled: true, weekday: 7, hour: 10 };

    const backup = createBackup(data, now, { settings: { ...settings, placeOrder: [...settings.placeOrder] }, reminder });

    expect(backup).toMatchObject({ settings: { ...settings, placeOrder: ['Kitchen'] }, reminder });
  });

  it('names the file after the local date', () => {
    expect(backupFileName(now)).toBe('home-stock-backup-2026-11-16.json');
    expect(backupFileName(new Date(2027, 0, 5))).toBe('home-stock-backup-2027-01-05.json');
  });

  it('knows when there is nothing to back up', () => {
    expect(hasStockData(data)).toBe(true);
    expect(
      hasStockData({ items: [], shoppingList: [], recentLocations: [], recentStores: [] }),
    ).toBe(false);
  });
});

describe('saving a backup file', () => {
  it('saves the weekly reminder in the file, and no settings when given none', async () => {
    const reminder = { enabled: false, weekday: 2, hour: 18 };
    await shareBackupFile(data, now, { reminder });

    const saved = JSON.parse(mockFiles.get('file:///cache/home-stock-backup-2026-11-16.json') ?? '{}');
    expect(saved.reminder).toEqual(reminder);
    expect(saved).not.toHaveProperty('settings');
  });

  it('writes the backup to a dated file and opens the share sheet for it', async () => {
    await shareBackupFile(data, now);

    const uri = 'file:///cache/home-stock-backup-2026-11-16.json';
    expect(JSON.parse(mockFiles.get(uri) ?? '')).toEqual(
      JSON.parse(JSON.stringify(createBackup(data, now))),
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      uri,
      expect.objectContaining({ mimeType: 'application/json' }),
    );
  });
});

describe('opening a backup file', () => {
  it('returns the parsed backup', async () => {
    mockPickFile.mockResolvedValue(pickedFile(JSON.stringify(createBackup(data, now))));

    const picked = await pickBackupFile();

    expect(picked).toEqual({ canceled: false, data: expect.objectContaining({ items: data.items }) });
  });

  it('reports a cancelled pick', async () => {
    mockPickFile.mockResolvedValue({ canceled: true, result: null });

    await expect(pickBackupFile()).resolves.toEqual({ canceled: true });
  });

  it('rejects a file that is not JSON', async () => {
    mockPickFile.mockResolvedValue(pickedFile('%PDF-1.7 not a backup'));

    await expect(pickBackupFile()).rejects.toThrow('This file is not a Home Stock backup.');
  });

  it('rejects a file that is far too large to be a backup', async () => {
    mockPickFile.mockResolvedValue(pickedFile('{}', 6 * 1024 * 1024));

    await expect(pickBackupFile()).rejects.toThrow('too large');
  });
});

describe('backup reminder', () => {
  const at = now.getTime();

  it('stays quiet when there is no stock', () => {
    expect(backupReminder(null, false, at)).toBeNull();
  });

  it('asks for a first backup', () => {
    expect(backupReminder(null, true, at)).toBe("You haven't backed up your stock yet.");
  });

  it('reminds again two weeks after the last backup', () => {
    expect(backupReminder(at - 13 * DAY, true, at)).toBeNull();
    expect(backupReminder(at - 14 * DAY, true, at)).toBe('Your last backup was 14 days ago.');
  });

  it('follows the reminder frequency chosen in Settings', () => {
    expect(backupReminder(at - 6 * DAY, true, at, 7)).toBeNull();
    expect(backupReminder(at - 7 * DAY, true, at, 7)).toBe('Your last backup was 7 days ago.');
    expect(backupReminder(at - 29 * DAY, true, at, 30)).toBeNull();
  });

  it('never reminds when the reminder is off', () => {
    expect(backupReminder(null, true, at, 0)).toBeNull();
    expect(backupReminder(at - 400 * DAY, true, at, 0)).toBeNull();
  });

  it('describes when the last backup was made', () => {
    expect(describeLastBackup(null, at)).toBe('No backup yet');
    expect(describeLastBackup(at - 60_000, at)).toBe('Last backup: today');
    expect(describeLastBackup(at - DAY, at)).toBe('Last backup: yesterday');
    expect(describeLastBackup(at - 9 * DAY, at)).toBe('Last backup: 9 days ago');
  });
});
