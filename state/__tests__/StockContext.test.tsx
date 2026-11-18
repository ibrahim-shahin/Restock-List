import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { StockProvider, useStock, type StockItemDraft } from '../StockContext';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

// In-memory stand-in for the SQLite-backed store.
const mockStorage = new Map<string, string>();
const mockFailures = { reads: false, writes: false, copyWrites: false };

jest.mock('../localStore', () => ({
  getLocalItem: jest.fn(async (key: string) => {
    if (mockFailures.reads) throw new Error('storage busy');
    return mockStorage.get(key) ?? null;
  }),
  setLocalItem: jest.fn(async (key: string, value: string) => {
    if (mockFailures.writes) throw new Error('disk full');
    if (mockFailures.copyWrites && key === 'home-stock:original-copies:v1') throw new Error('disk full');
    mockStorage.set(key, value);
  }),
}));

const STORAGE_KEY = 'home-stock:guest:v1';
const SAVED_COPIES_KEY = 'home-stock:original-copies:v1';

function savedCopyTexts(): string[] {
  return JSON.parse(mockStorage.get(SAVED_COPIES_KEY) ?? '[]').map((copy: { text: string }) => copy.text);
}

const milk: StockItemDraft = {
  name: 'Whole Milk',
  minimumQuantity: 1,
  restockQuantity: 2,
  unit: 'L',
  location: 'Fridge',
  storeTypes: ['Supermarket'],
};
const bread: StockItemDraft = {
  name: 'Bread',
  minimumQuantity: 0,
  restockQuantity: 1,
  unit: '',
  location: 'Pantry',
  storeTypes: ['Supermarket', 'Bakery'],
};
const batteries: StockItemDraft = {
  name: 'AA Batteries',
  minimumQuantity: 4,
  restockQuantity: 8,
  unit: '',
  location: 'Drawer',
  storeTypes: ['Hardware'],
};

function Wrapper({ children }: { children: ReactNode }) {
  return <StockProvider>{children}</StockProvider>;
}

async function renderStock() {
  const hook = await renderHook(() => useStock(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

function savedSnapshot() {
  const raw = mockStorage.get(STORAGE_KEY);
  if (raw === undefined) throw new Error('Nothing has been saved yet.');
  return JSON.parse(raw);
}

function entryId(itemId: string, store: string) {
  return JSON.stringify([itemId, store]);
}

beforeEach(() => {
  mockStorage.clear();
  mockFailures.reads = false;
  mockFailures.writes = false;
  mockFailures.copyWrites = false;
  jest.clearAllMocks();
});

describe('loading', () => {
  it('starts empty when nothing is saved', async () => {
    const { result } = await renderStock();

    expect(result.current.items).toEqual([]);
    expect(result.current.shoppingList).toEqual([]);
    expect(result.current.storageError).toBeNull();
    expect(savedSnapshot()).toEqual({
      items: [],
      shoppingList: [],
      recentLocations: [],
      recentStores: [],
    });
  });

  it('loads saved stock written by the earlier sync version and drops its metadata', async () => {
    mockStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        items: [{ id: 'rice', name: 'Rice', minimumQuantity: 1, restockQuantity: 1, unit: 'kg', location: 'Pantry', storeTypes: ['Market'], createdAt: 5 }],
        shoppingList: [],
        recentLocations: ['Pantry'],
        recentStores: ['Market'],
        _localUpdatedAt: 1,
        _cloudUpdatedAt: 2,
        _dirty: true,
      }),
    );

    const { result } = await renderStock();

    expect(result.current.items.map((item) => item.name)).toEqual(['Rice']);
    expect(result.current.recentLocations).toEqual(['Pantry']);
    await waitFor(() => expect(savedSnapshot()).not.toHaveProperty('_dirty'));
    expect(savedSnapshot()).not.toHaveProperty('_cloudUpdatedAt');
  });

  it('repairs item ids that do not match the item name, including buy-list entries', async () => {
    mockStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        items: [{ id: 'random-123', name: 'Rice', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Pantry', storeTypes: ['Market'], createdAt: 5 }],
        shoppingList: [{ id: 'random-123', entryId: 'old', name: 'Rice', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Pantry', storeTypes: ['Market'], createdAt: 5, shoppingStoreType: 'Market', purchased: true }],
        recentLocations: [],
        recentStores: [],
      }),
    );

    const { result } = await renderStock();

    expect(result.current.items[0].id).toBe('rice');
    expect(result.current.shoppingList[0]).toMatchObject({
      id: 'rice',
      entryId: entryId('rice', 'Market'),
      purchased: true,
    });
  });

  it('keeps unreadable saved data untouched instead of overwriting it', async () => {
    mockStorage.set(STORAGE_KEY, '{not valid json');

    const { result } = await renderStock();
    expect(result.current.storageError).toMatch(/could not be opened/);

    await act(() => {
      result.current.saveItem(milk);
    });

    expect(result.current.items).toHaveLength(1);
    expect(mockStorage.get(STORAGE_KEY)).toBe('{not valid json');
  });

  it('shows the saved stock again after the app restarts', async () => {
    const first = await renderStock();
    await act(() => {
      first.result.current.saveItem(milk);
    });
    await waitFor(() => expect(savedSnapshot().items).toHaveLength(1));
    await first.unmount();

    const second = await renderStock();
    expect(second.result.current.items.map((item) => item.name)).toEqual(['Whole Milk']);
  });
});

describe('saving items', () => {
  it('adds an item with an id based on its name and saves it on the device', async () => {
    const { result } = await renderStock();

    let id: string | null = null;
    await act(() => {
      id = result.current.saveItem({ ...milk, name: '  Whole Milk  ' });
    });

    expect(id).toBe('wholemilk');
    expect(result.current.items).toEqual([
      expect.objectContaining({ ...milk, id: 'wholemilk', createdAt: expect.any(Number) }),
    ]);
    await waitFor(() =>
      expect(savedSnapshot().items).toEqual([expect.objectContaining({ id: 'wholemilk' })]),
    );
  });

  it('rejects a second item with the same name, ignoring case and spaces', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });

    let id: string | null = 'unset';
    await act(() => {
      id = result.current.saveItem({ ...milk, name: 'wholemilk' });
    });

    expect(id).toBeNull();
    expect(result.current.items).toHaveLength(1);
  });

  it('renaming an item updates its buy-list entries and keeps them ticked', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });
    await act(() => {
      result.current.createBuyList(['wholemilk'], 'Supermarket');
    });
    await act(() => {
      result.current.togglePurchased(entryId('wholemilk', 'Supermarket'));
    });

    let id: string | null = null;
    await act(() => {
      id = result.current.saveItem({ ...milk, name: 'Oat Milk', restockQuantity: 3 }, 'wholemilk');
    });

    expect(id).toBe('oatmilk');
    expect(result.current.items.map((item) => item.id)).toEqual(['oatmilk']);
    expect(result.current.shoppingList).toEqual([
      expect.objectContaining({
        id: 'oatmilk',
        entryId: entryId('oatmilk', 'Supermarket'),
        name: 'Oat Milk',
        restockQuantity: 3,
        purchased: true,
      }),
    ]);
  });

  it('remembers recent places, newest first, without duplicates', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });
    await act(() => {
      result.current.saveItem(bread);
    });
    await act(() => {
      result.current.saveItem({ ...batteries, location: 'fridge' });
    });

    expect(result.current.recentLocations).toEqual(['Fridge', 'Pantry']);
    expect(result.current.recentStores).toEqual(['Hardware', 'Bakery', 'Supermarket']);
  });

  it('deleteItem removes the item', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });

    await act(() => {
      result.current.deleteItem('wholemilk');
    });

    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(savedSnapshot().items).toEqual([]));
  });
});

describe('keeping data consistent', () => {
  it('reuses the existing spelling of a store or location typed in another case', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });
    await act(() => {
      result.current.saveItem({ ...batteries, location: 'fridge', storeTypes: ['supermarket', 'Hardware'] });
    });

    expect(result.current.items[1]).toMatchObject({
      location: 'Fridge',
      storeTypes: ['Supermarket', 'Hardware'],
    });
    await act(() => {
      result.current.createBuyList(['wholemilk', 'aabatteries'], 'Supermarket');
    });
    expect(result.current.shoppingList.map((entry) => entry.id)).toEqual(['wholemilk', 'aabatteries']);
  });

  it('keeps every store an item is sold at, even more than ten', async () => {
    const { result } = await renderStock();
    const stores = Array.from({ length: 12 }, (_, index) => `Store ${index + 1}`);

    await act(() => {
      result.current.saveItem({ ...milk, storeTypes: stores });
    });

    expect(result.current.items[0].storeTypes).toEqual(stores);
    expect(result.current.recentStores).toHaveLength(10);
  });

  it('deleting an item also removes it from the buy list', async () => {
    const { result } = await renderStock();
    for (const draft of [milk, bread]) {
      await act(() => {
        result.current.saveItem(draft);
      });
    }
    await act(() => {
      result.current.createBuyList(['wholemilk', 'bread'], 'Supermarket');
    });

    await act(() => {
      result.current.deleteItem('wholemilk');
    });

    expect(result.current.shoppingList.map((entry) => entry.id)).toEqual(['bread']);
  });

  it('removing a store from an item removes its buy-list entry for that store', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(bread);
    });
    await act(() => {
      result.current.createBuyList(['bread'], 'Bakery');
    });
    await act(() => {
      result.current.createBuyList(['bread'], 'Supermarket');
    });

    await act(() => {
      result.current.saveItem({ ...bread, storeTypes: ['Supermarket'] }, 'bread');
    });

    expect(result.current.shoppingList.map((entry) => entry.entryId)).toEqual([
      entryId('bread', 'Supermarket'),
    ]);
  });
});

describe('buy list', () => {
  it("replaces one store's list and only includes items sold there", async () => {
    const { result } = await renderStock();
    for (const draft of [milk, bread, batteries]) {
      await act(() => {
        result.current.saveItem(draft);
      });
    }

    await act(() => {
      result.current.createBuyList(['wholemilk', 'bread', 'aabatteries'], 'Supermarket');
    });
    await act(() => {
      result.current.createBuyList(['bread'], 'Bakery');
    });
    expect(result.current.shoppingList.map((entry) => entry.entryId)).toEqual([
      entryId('wholemilk', 'Supermarket'),
      entryId('bread', 'Supermarket'),
      entryId('bread', 'Bakery'),
    ]);

    await act(() => {
      result.current.createBuyList(['bread'], 'Supermarket');
    });
    expect(result.current.shoppingList.map((entry) => entry.entryId)).toEqual([
      entryId('bread', 'Bakery'),
      entryId('bread', 'Supermarket'),
    ]);
  });

  it('ticks items off and clears only the ticked ones', async () => {
    const { result } = await renderStock();
    for (const draft of [milk, bread]) {
      await act(() => {
        result.current.saveItem(draft);
      });
    }
    await act(() => {
      result.current.createBuyList(['wholemilk', 'bread'], 'Supermarket');
    });

    await act(() => {
      result.current.togglePurchased(entryId('bread', 'Supermarket'));
    });
    expect(result.current.shoppingList.find((entry) => entry.id === 'bread')?.purchased).toBe(true);

    await act(() => {
      result.current.clearPurchased();
    });
    expect(result.current.shoppingList.map((entry) => entry.id)).toEqual(['wholemilk']);
  });
});

describe('importing a backup', () => {
  async function exportedBackup() {
    const source = await renderStock();
    for (const draft of [milk, bread]) {
      await act(() => {
        source.result.current.saveItem(draft);
      });
    }
    await act(() => {
      source.result.current.createBuyList(['bread'], 'Bakery');
    });
    const { items, shoppingList, recentLocations, recentStores } = source.result.current;
    // Same shape as the Export JSON button in app/data-tools.tsx.
    const backup = JSON.stringify({
      format: 'home-stock-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      items,
      shoppingList,
      recentLocations,
      recentStores,
    });
    await source.unmount();
    mockStorage.clear();
    return { backup, items, shoppingList };
  }

  it('restores an exported backup on a fresh install', async () => {
    const { backup, items, shoppingList } = await exportedBackup();
    const { result } = await renderStock();

    let counts: ReturnType<typeof result.current.importBackup> | undefined;
    await act(() => {
      counts = result.current.importBackup(JSON.parse(backup));
    });

    expect(counts).toEqual({ importedCount: 2, skippedCount: 0, shoppingListAddedCount: 1 });
    expect(result.current.items).toEqual(items);
    expect(result.current.shoppingList).toEqual(shoppingList);
    expect(result.current.recentStores).toEqual(['Bakery', 'Supermarket']);
  });

  it('skips items that already exist and keeps the existing copy', async () => {
    const { backup } = await exportedBackup();
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem({ ...milk, minimumQuantity: 9 });
    });

    let counts: ReturnType<typeof result.current.importBackup> | undefined;
    await act(() => {
      counts = result.current.importBackup(JSON.parse(backup));
    });

    expect(counts).toEqual({ importedCount: 1, skippedCount: 1, shoppingListAddedCount: 1 });
    expect(result.current.items.find((item) => item.id === 'wholemilk')?.minimumQuantity).toBe(9);
    expect(result.current.items).toHaveLength(2);
  });

  it('accepts a plain list of items', async () => {
    const { result } = await renderStock();

    await act(() => {
      result.current.importBackup([{ ...batteries }]);
    });

    expect(result.current.items.map((item) => item.id)).toEqual(['aabatteries']);
  });

  it('rejects JSON that has no Home Stock data', async () => {
    const { result } = await renderStock();

    expect(() => result.current.importBackup({})).toThrow('The JSON does not contain any saved Home Stock data.');
    expect(() => result.current.importBackup({ items: [] })).toThrow('The JSON does not contain any saved Home Stock data.');
  });

  it('rejects quantities that are not numbers', async () => {
    const { result } = await renderStock();

    expect(() => result.current.importBackup([{ ...batteries, minimumQuantity: null }])).toThrow(
      /missing valid stock details/,
    );
    expect(() => result.current.importBackup([{ ...batteries, restockQuantity: true }])).toThrow(
      /missing valid stock details/,
    );
    expect(result.current.items).toEqual([]);
  });

  it('rejects an item with missing details and changes nothing', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });

    expect(() =>
      result.current.importBackup({
        items: [{ name: 'Soap', minimumQuantity: 1, restockQuantity: 1, storeTypes: ['Market'] }],
      }),
    ).toThrow(/Soap.*missing valid stock details/);
    expect(result.current.items.map((item) => item.id)).toEqual(['wholemilk']);
  });
});

describe('storage errors', () => {
  it('keeps the warning when saved stock could not be opened, and refuses imports it cannot save', async () => {
    mockStorage.set(STORAGE_KEY, '{not valid json');
    const { result } = await renderStock();

    await act(() => {
      result.current.saveItem(milk);
    });

    expect(result.current.storageError).toMatch(/could not be opened/);
    expect(() => result.current.importBackup([{ ...bread }])).toThrow(/could not be opened/);
    expect(mockStorage.get(STORAGE_KEY)).toBe('{not valid json');
  });

  it('retries a failed save even when the same change is made again', async () => {
    const { result } = await renderStock();
    mockFailures.writes = true;
    await act(() => {
      result.current.saveItem(milk);
    });
    await waitFor(() => expect(result.current.storageError).toMatch(/could not be saved/));

    mockFailures.writes = false;
    await act(() => {
      result.current.saveItem(milk, 'wholemilk');
    });

    await waitFor(() => expect(savedSnapshot().items).toHaveLength(1));
    await waitFor(() => expect(result.current.storageError).toBeNull());
  });

  it('shows an error when a change cannot be saved, and clears it after the next successful save', async () => {
    const { result } = await renderStock();
    mockFailures.writes = true;

    await act(() => {
      result.current.saveItem(milk);
    });
    await waitFor(() => expect(result.current.storageError).toMatch(/could not be saved/));

    mockFailures.writes = false;
    await act(() => {
      result.current.saveItem(bread);
    });
    await waitFor(() => expect(result.current.storageError).toBeNull());
    expect(savedSnapshot().items).toHaveLength(2);
  });
});

describe('recovering saved stock', () => {
  const rice = { id: 'rice', name: 'Rice', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Pantry', storeTypes: ['Market'], createdAt: 5 };
  const soapWithoutPlace = { id: 'soap', name: 'Soap', minimumQuantity: 1, restockQuantity: 1, unit: '', storeTypes: ['Market'], createdAt: 6 };

  it('loads the readable items, keeps a copy of the original and says what was left out', async () => {
    const original = JSON.stringify({ items: [rice, soapWithoutPlace], shoppingList: [], recentLocations: [], recentStores: [] });
    mockStorage.set(STORAGE_KEY, original);

    const { result } = await renderStock();

    expect(result.current.items.map((item) => item.id)).toEqual(['rice']);
    expect(result.current.loadNotice).toMatch(/1 saved item couldn't be read/);
    expect(result.current.loadProblem).toBeNull();
    expect(result.current.storageError).toBeNull();
    expect(savedCopyTexts()).toEqual([original]);
    expect(result.current.savedCopyCount).toBe(1);
    expect(savedSnapshot().items.map((item: { id: string }) => item.id)).toEqual(['rice']);
    await expect(result.current.getRecoveryData()).resolves.toContain(JSON.stringify(original));

    await act(() => {
      result.current.dismissLoadNotice();
    });
    expect(result.current.loadNotice).toBeNull();
  });

  it('changes nothing and offers Try again when the original copy cannot be kept', async () => {
    const original = JSON.stringify({ items: [rice, soapWithoutPlace], shoppingList: [], recentLocations: [], recentStores: [] });
    mockStorage.set(STORAGE_KEY, original);
    mockFailures.copyWrites = true;

    const { result } = await renderStock();

    expect(result.current.loadProblem).toBe('read-failed');
    expect(mockStorage.get(STORAGE_KEY)).toBe(original);

    mockFailures.copyWrites = false;
    await act(() => {
      result.current.retryLoad();
    });

    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['rice']));
    expect(result.current.loadProblem).toBeNull();
    expect(savedCopyTexts()).toEqual([original]);
  });

  it('keeps earlier copies instead of writing over them', async () => {
    const first = JSON.stringify({ items: [rice, soapWithoutPlace], shoppingList: [], recentLocations: [], recentStores: [] });
    mockStorage.set(STORAGE_KEY, first);
    const firstRun = await renderStock();
    await firstRun.unmount();

    const second = JSON.stringify({ items: [rice, { ...soapWithoutPlace, name: 'Shampoo' }], shoppingList: [], recentLocations: [], recentStores: [] });
    mockStorage.set(STORAGE_KEY, second);
    const { result } = await renderStock();

    expect(savedCopyTexts()).toEqual([first, second]);
    expect(result.current.savedCopyCount).toBe(2);
  });

  it('deletes the kept copies when asked', async () => {
    mockStorage.set(STORAGE_KEY, JSON.stringify({ items: [rice, soapWithoutPlace], shoppingList: [], recentLocations: [], recentStores: [] }));
    const { result } = await renderStock();

    await act(async () => {
      await result.current.deleteSavedCopies();
    });

    expect(result.current.savedCopyCount).toBe(0);
    expect(savedCopyTexts()).toEqual([]);
    await expect(result.current.getRecoveryData()).resolves.toBeNull();
  });

  it('starts fresh after unreadable data, keeping a copy of it, and can import again', async () => {
    mockStorage.set(STORAGE_KEY, '{not valid json');
    const { result } = await renderStock();
    expect(result.current.loadProblem).toBe('unreadable');
    await expect(result.current.getRecoveryData()).resolves.toBe('{not valid json');

    await act(async () => {
      await result.current.startFresh();
    });

    expect(result.current.loadProblem).toBeNull();
    expect(result.current.storageError).toBeNull();
    expect(savedCopyTexts()).toEqual(['{not valid json']);
    expect(result.current.savedCopyCount).toBe(1);
    await waitFor(() => expect(savedSnapshot().items).toEqual([]));
    await act(() => {
      result.current.importBackup([{ ...bread }]);
    });
    await waitFor(() => expect(savedSnapshot().items).toHaveLength(1));
  });

  it('tries again after the saved stock could not be read', async () => {
    mockStorage.set(STORAGE_KEY, JSON.stringify({ items: [rice], shoppingList: [], recentLocations: [], recentStores: [] }));
    mockFailures.reads = true;
    const { result } = await renderStock();
    expect(result.current.loadProblem).toBe('read-failed');
    expect(result.current.storageError).toMatch(/could not be read/);
    expect(() => result.current.importBackup([{ ...bread }])).toThrow(/Try again/);

    mockFailures.reads = false;
    await act(() => {
      result.current.retryLoad();
    });

    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['rice']));
    expect(result.current.loadProblem).toBeNull();
    expect(result.current.storageError).toBeNull();
  });
});

describe('one-time items', () => {
  const candles = { name: ' Birthday candles ', quantity: 2, unit: 'packs', store: 'supermarket' };

  function buyListNames(result: { current: { shoppingList: { name: string }[] } }) {
    return result.current.shoppingList.map((entry) => entry.name);
  }

  it('adds a one-time item to the buy list without adding it to the stock', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });

    let message: string | null = 'not called';
    await act(() => {
      message = result.current.addOneTimeItem(candles);
    });

    expect(message).toBeNull();
    expect(result.current.items.map((item) => item.id)).toEqual(['wholemilk']);
    expect(result.current.shoppingList).toEqual([
      expect.objectContaining({
        name: 'Birthday candles',
        restockQuantity: 2,
        unit: 'packs',
        shoppingStoreType: 'Supermarket',
        purchased: false,
        oneTime: true,
      }),
    ]);
    await waitFor(() => expect(savedSnapshot().shoppingList).toHaveLength(1));
  });

  it('says what to fix', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.addOneTimeItem({ ...candles, store: 'Supermarket' });
    });

    expect(result.current.addOneTimeItem({ ...candles, name: '  ' })).toBe('Add what you need.');
    expect(result.current.addOneTimeItem({ ...candles, store: ' ' })).toBe('Choose where you will buy it.');
    expect(result.current.addOneTimeItem({ ...candles, name: 'Cake', quantity: 0 })).toBe('Enter how many you need.');
    expect(result.current.addOneTimeItem({ ...candles, name: 'birthday CANDLES' })).toBe(
      'birthday CANDLES is already on your list for Supermarket.',
    );
    expect(result.current.shoppingList).toHaveLength(1);
  });

  it('keeps one-time items through a new check of their store until they are ticked off', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });
    await act(() => {
      result.current.addOneTimeItem(candles);
    });
    await act(() => {
      result.current.addOneTimeItem({ ...candles, name: 'Cake' });
    });
    await act(() => {
      result.current.addOneTimeItem({ ...candles, name: 'Croissants', store: 'Bakery' });
    });
    const cake = result.current.shoppingList.find((entry) => entry.name === 'Cake');
    await act(() => {
      result.current.togglePurchased(cake?.entryId ?? '');
    });

    await act(() => {
      result.current.createBuyList(['wholemilk'], 'Supermarket');
    });

    expect(buyListNames(result)).toEqual(['Croissants', 'Whole Milk', 'Birthday candles']);
  });

  it('keeps a one-time item next to the same thing from stock, also when an answer changes', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });
    await act(() => {
      result.current.addOneTimeItem({ ...candles, name: 'whole milk', quantity: 6 });
    });

    await act(() => {
      result.current.createBuyList(['wholemilk'], 'Supermarket');
    });
    expect(result.current.shoppingList).toEqual([
      expect.objectContaining({ id: 'wholemilk', name: 'Whole Milk' }),
      expect.objectContaining({ name: 'whole milk', restockQuantity: 6, oneTime: true }),
    ]);

    // "Change my last answer" rebuilds the store's list; the one-time item stays.
    await act(() => {
      result.current.createBuyList([], 'Supermarket');
    });
    expect(result.current.shoppingList).toEqual([
      expect.objectContaining({ name: 'whole milk', restockQuantity: 6, oneTime: true }),
    ]);
  });

  it('keeps one-time items after the app restarts', async () => {
    const first = await renderStock();
    await act(() => {
      first.result.current.addOneTimeItem(candles);
    });
    const { id, entryId } = first.result.current.shoppingList[0];
    await waitFor(() => expect(savedSnapshot().shoppingList).toHaveLength(1));
    await first.unmount();

    const second = await renderStock();

    expect(second.result.current.shoppingList).toEqual([
      expect.objectContaining({ id, entryId, name: 'Birthday candles', oneTime: true }),
    ]);
  });

  it('leaves one-time items alone when a stock item is renamed or deleted', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });
    await act(() => {
      result.current.addOneTimeItem({ ...candles, name: 'Oat Milk' });
    });

    await act(() => {
      result.current.saveItem({ ...milk, name: 'Oat Milk' }, 'wholemilk');
    });
    await act(() => {
      result.current.deleteItem('oatmilk');
    });

    expect(result.current.shoppingList).toEqual([
      expect.objectContaining({ name: 'Oat Milk', oneTime: true }),
    ]);
  });

  it('removes an entry from the buy list', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.addOneTimeItem(candles);
    });

    await act(() => {
      result.current.removeFromBuyList(result.current.shoppingList[0].entryId);
    });

    expect(result.current.shoppingList).toEqual([]);
    expect(result.current.removeFromBuyList('not listed')).toBeNull();
  });

  it("doesn't put an entry back when the same thing was added again meanwhile", async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.addOneTimeItem({ ...candles, name: 'Cake' });
    });
    let restore: (() => void) | null = null;
    await act(() => {
      restore = result.current.removeFromBuyList(result.current.shoppingList[0].entryId);
    });
    await act(() => {
      result.current.addOneTimeItem({ ...candles, name: 'cake' });
    });

    await act(() => {
      restore?.();
    });

    expect(buyListNames(result)).toEqual(['cake']);
  });

  it('puts a removed entry back where it was', async () => {
    const { result } = await renderStock();
    for (const name of ['Candles', 'Cake', 'Balloons']) {
      await act(() => {
        result.current.addOneTimeItem({ ...candles, name });
      });
    }

    let restore: (() => void) | null = null;
    await act(() => {
      restore = result.current.removeFromBuyList(result.current.shoppingList[1].entryId);
    });
    expect(buyListNames(result)).toEqual(['Candles', 'Balloons']);

    await act(() => {
      restore?.();
    });
    await act(() => {
      restore?.();
    });

    expect(buyListNames(result)).toEqual(['Candles', 'Cake', 'Balloons']);
    await waitFor(() => expect(savedSnapshot().shoppingList).toHaveLength(3));
  });

  it('backs up and restores one-time items without merging them into stock items', async () => {
    const source = await renderStock();
    await act(() => {
      source.result.current.addOneTimeItem({ ...candles, name: 'Whole Milk' });
    });
    const { shoppingList, recentStores } = source.result.current;
    const backup = JSON.parse(JSON.stringify({ items: [], shoppingList, recentLocations: [], recentStores }));
    await source.unmount();
    mockStorage.clear();

    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem(milk);
    });
    await act(() => {
      result.current.importBackup(backup);
    });
    await act(() => {
      result.current.importBackup(backup);
    });

    expect(result.current.shoppingList).toEqual([
      expect.objectContaining({ id: shoppingList[0].id, name: 'Whole Milk', oneTime: true }),
    ]);
  });
});

describe('item emoji', () => {
  it('saves a chosen emoji with the item and keeps it after a restart', async () => {
    const first = await renderStock();
    await act(() => {
      first.result.current.saveItem({ ...milk, emoji: ' 🧃 ' });
    });
    expect(first.result.current.items[0].emoji).toBe('🧃');
    await waitFor(() => expect(savedSnapshot().items[0].emoji).toBe('🧃'));
    await first.unmount();

    const second = await renderStock();
    expect(second.result.current.items[0].emoji).toBe('🧃');
  });

  it('leaves the emoji out when none was chosen, so it is picked from the name', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem({ ...milk, emoji: '' });
    });

    expect(result.current.items[0]).not.toHaveProperty('emoji');
  });

  it('ignores an emoji that is not one', async () => {
    mockStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        items: [
          { name: 'Rice', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Pantry', storeTypes: ['Market'], createdAt: 1, emoji: 'x'.repeat(40) },
          { name: 'Tea', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Pantry', storeTypes: ['Market'], createdAt: 2, emoji: 7 },
          { name: 'Salt', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Pantry', storeTypes: ['Market'], createdAt: 3, emoji: 'ab' },
          { name: 'Milk', minimumQuantity: 1, restockQuantity: 1, unit: '', location: 'Fridge', storeTypes: ['Market'], createdAt: 4, emoji: '🧃' },
        ],
        shoppingList: [],
        recentLocations: [],
        recentStores: [],
      }),
    );

    const { result } = await renderStock();

    expect(result.current.items.map((item) => item.emoji)).toEqual([undefined, undefined, undefined, '🧃']);
  });
});

describe('item notes', () => {
  it('saves a trimmed note and shows it on the buy list, also after an edit', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem({ ...milk, note: '  Full fat  ' });
    });
    await act(() => {
      result.current.createBuyList(['wholemilk'], 'Supermarket');
    });
    expect(result.current.shoppingList[0].note).toBe('Full fat');

    await act(() => {
      result.current.saveItem({ ...milk, note: 'Lactose free' }, 'wholemilk');
    });

    expect(result.current.items[0].note).toBe('Lactose free');
    expect(result.current.shoppingList[0].note).toBe('Lactose free');
    await waitFor(() => expect(savedSnapshot().items[0].note).toBe('Lactose free'));
  });

  it('drops an empty note and caps long ones', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem({ ...milk, note: '   ' });
    });
    await act(() => {
      result.current.saveItem({ ...bread, note: 'x'.repeat(300) });
    });

    expect(result.current.items[0]).not.toHaveProperty('note');
    expect(result.current.items[1].note).toHaveLength(200);
  });

  it('keeps the note of a one-time item', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.addOneTimeItem({ name: 'Candles', quantity: 1, unit: '', store: 'Supermarket', note: ' Number 7 ' });
    });

    expect(result.current.shoppingList[0].note).toBe('Number 7');
  });
});

describe('item prices', () => {
  it('saves a price rounded to the thousandth, copies it to the buy list and keeps it after a restart', async () => {
    const first = await renderStock();
    await act(() => {
      first.result.current.saveItem({ ...milk, price: 1.2555 });
    });
    await act(() => {
      first.result.current.createBuyList(['wholemilk'], 'Supermarket');
    });
    expect(first.result.current.items[0].price).toBe(1.256);
    expect(first.result.current.shoppingList[0].price).toBe(1.256);
    await waitFor(() => expect(savedSnapshot().items[0].price).toBe(1.256));
    await first.unmount();

    const second = await renderStock();
    expect(second.result.current.items[0].price).toBe(1.256);
  });

  it('leaves out prices that are not valid, and lets one-time items have one', async () => {
    const { result } = await renderStock();
    await act(() => {
      result.current.saveItem({ ...milk, price: -2 });
    });
    await act(() => {
      result.current.addOneTimeItem({ name: 'Cake', quantity: 1, unit: '', store: 'Bakery', price: 7.5 });
    });

    expect(result.current.items[0]).not.toHaveProperty('price');
    expect(result.current.shoppingList[0].price).toBe(7.5);
  });
});
