import * as Haptics from 'expo-haptics';
import { getLocalItem, setLocalItem } from './localStore';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type StockItem = {
  id: string;
  name: string;
  minimumQuantity: number;
  restockQuantity: number;
  unit: string;
  location: string;
  storeTypes: string[];
  createdAt: number;
};

export type StockItemDraft = Omit<StockItem, 'id' | 'createdAt'>;

export type BuyListItem = StockItem & {
  entryId: string;
  shoppingStoreType: string;
  purchased: boolean;
};

export type SavedData = {
  items: StockItem[];
  shoppingList: BuyListItem[];
  recentLocations: string[];
  recentStores: string[];
};

type StockContextValue = SavedData & {
  isLoading: boolean;
  storageError: string | null;
  saveItem: (draft: StockItemDraft, id?: string) => string | null;
  deleteItem: (id: string) => void;
  createBuyList: (itemIds: string[], storeType: string) => void;
  togglePurchased: (entryId: string) => void;
  clearPurchased: () => void;
  // Set while the saved stock can't be loaded; saving stays off meanwhile.
  loadProblem: LoadProblem | null;
  // Set when some saved items couldn't be read and were left out.
  loadNotice: string | null;
  dismissLoadNotice: () => void;
  retryLoad: () => void;
  startFresh: () => Promise<void>;
  // How many copies of damaged saved data are kept on the device.
  savedCopyCount: number;
  // The unreadable saved text while it can't be opened, otherwise the kept copies.
  getRecoveryData: () => Promise<string | null>;
  deleteSavedCopies: () => Promise<void>;
  importBackup: (data: unknown) => {
    importedCount: number;
    skippedCount: number;
    shoppingListAddedCount: number;
  };
};

// Where the stock is saved. The name dates from an earlier version of the app.
const STORAGE_KEY = 'home-stock:guest:v1';
// Copies of saved stock that couldn't be fully read, kept before it is replaced.
// New copies are added, never written over; only the newest few are kept.
const SAVED_COPIES_KEY = 'home-stock:original-copies:v1';
const MAX_SAVED_COPIES = 5;

type SavedCopy = { savedAt: number; text: string };

async function readSavedCopies(): Promise<SavedCopy[]> {
  const saved = await getLocalItem(SAVED_COPIES_KEY);
  if (!saved) return [];
  try {
    const value: unknown = JSON.parse(saved);
    return Array.isArray(value)
      ? value.filter(
          (copy): copy is SavedCopy =>
            typeof copy?.text === 'string' && typeof copy?.savedAt === 'number',
        )
      : [];
  } catch {
    return [];
  }
}

/** Adds a copy unless the same text is already kept; returns how many are kept. */
async function keepSavedCopy(text: string): Promise<number> {
  const copies = await readSavedCopies();
  if (copies.some((copy) => copy.text === text)) return copies.length;
  const next = [...copies, { savedAt: Date.now(), text }].slice(-MAX_SAVED_COPIES);
  await setLocalItem(SAVED_COPIES_KEY, JSON.stringify(next));
  return next.length;
}

export type LoadProblem = 'read-failed' | 'unreadable';

const LOAD_ERRORS: Record<LoadProblem, string> = {
  'read-failed':
    "Your saved stock could not be read, so changes won't be saved. Open Backup to try again.",
  unreadable:
    "Your saved stock could not be opened, so changes won't be saved. Open Backup to recover it.",
};

const IMPORT_BLOCKED: Record<LoadProblem, string> = {
  'read-failed':
    'Your saved stock could not be read. Tap Try again first, then import your backup.',
  unreadable:
    'Your saved stock could not be opened. Choose Start fresh first, then import your backup.',
};
const StockContext = createContext<StockContextValue | null>(null);
const MAX_RECENT_PLACES = 10;
const EMPTY_SAVED_DATA: SavedData = {
  items: [],
  shoppingList: [],
  recentLocations: [],
  recentStores: [],
};

function itemIdFromName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
}

function assignUniqueItemId(name: string, usedIds: Set<string>): string {
  const baseId = itemIdFromName(name);
  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${baseId}~${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('An item in the saved data is not valid.');
  }
  return value as Record<string, unknown>;
}

// Trimmed, non-empty strings with duplicates removed, ignoring case.
function uniqueNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function uniquePlaces(values: unknown): string[] {
  return uniqueNames(values).slice(0, MAX_RECENT_PLACES);
}

// The trimmed value, spelled the way `known` already spells it when one of
// them matches without regard to case.
function matchSpelling(value: string, known: string[]): string {
  const trimmed = value.trim();
  const key = trimmed.toLocaleLowerCase();
  return known.find((candidate) => candidate.toLocaleLowerCase() === key) ?? trimmed;
}

function rememberPlace(place: string, recent: string[]): string[] {
  const cleanPlace = place.trim();
  if (!cleanPlace) return recent;
  return uniquePlaces([cleanPlace, ...recent]);
}

function readStoreTypes(record: Record<string, unknown>): string[] {
  const values = Array.isArray(record.storeTypes)
    ? record.storeTypes
    : typeof record.storeType === 'string'
      ? [record.storeType]
      : [];
  return uniqueNames(values);
}

function normalizeStockItem(
  value: unknown,
  imported = false,
  legacyCreatedAt = 0,
  idOverride?: string,
): StockItem {
  const record = asRecord(value);
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const location = typeof record.location === 'string' ? record.location.trim() : '';
  const storeTypes = readStoreTypes(record);
  const { minimumQuantity, restockQuantity } = record;

  if (
    !name ||
    !location ||
    storeTypes.length === 0 ||
    typeof minimumQuantity !== 'number' ||
    !Number.isInteger(minimumQuantity) ||
    minimumQuantity < 0 ||
    typeof restockQuantity !== 'number' ||
    !Number.isInteger(restockQuantity) ||
    restockQuantity < 1
  ) {
    throw new Error(`“${name || 'An item'}” is missing valid stock details.`);
  }

  return {
    id: idOverride ?? itemIdFromName(name),
    name,
    minimumQuantity,
    restockQuantity,
    unit: typeof record.unit === 'string' ? record.unit : '',
    location,
    storeTypes,
    createdAt:
      typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
        ? record.createdAt
        : imported
          ? Date.now()
          : legacyCreatedAt,
  };
}

// Without onInvalid, any invalid record throws. With it, invalid records are
// reported and left out, so the rest of the saved stock still loads.
function normalizeSavedData(
  value: unknown,
  imported = false,
  onInvalid?: () => void,
): SavedData {
  const record = asRecord(value);
  if (!Array.isArray(record.items) || !Array.isArray(record.shoppingList)) {
    throw new Error('Your saved stock has an unexpected format.');
  }

  const usedItemIds = new Set<string>();
  const itemIdBySourceId = new Map<string, string>();
  const skipInvalid = (error: unknown) => {
    if (!onInvalid) throw error;
    onInvalid();
  };
  const items: StockItem[] = [];
  record.items.forEach((value, index) => {
    let item: StockItem;
    try {
      item = normalizeStockItem(value, imported, index);
    } catch (error) {
      skipInvalid(error);
      return;
    }
    const id = assignUniqueItemId(item.name, usedItemIds);
    const sourceId = asRecord(value).id;
    if (typeof sourceId === 'string' && !itemIdBySourceId.has(sourceId)) {
      itemIdBySourceId.set(sourceId, id);
    }
    items.push({ ...item, id });
  });
  const shoppingListByEntryId = new Map<string, BuyListItem>();
  record.shoppingList.forEach((value) => {
    try {
      addBuyListEntry(value);
    } catch (error) {
      skipInvalid(error);
    }
  });
  function addBuyListEntry(value: unknown) {
    const itemRecord = asRecord(value);
    const sourceId =
      typeof itemRecord.id === 'string' ? itemRecord.id : '';
    const item = normalizeStockItem(
      value,
      imported,
      0,
      itemIdBySourceId.get(sourceId),
    );
    const shoppingStoreType =
      typeof itemRecord.shoppingStoreType === 'string'
        ? itemRecord.shoppingStoreType
        : typeof itemRecord.storeType === 'string'
          ? itemRecord.storeType
          : item.storeTypes[0];
    if (!shoppingStoreType) {
      throw new Error('A saved buy-list item is missing its store.');
    }
    const entryId = JSON.stringify([item.id, shoppingStoreType]);
    shoppingListByEntryId.set(entryId, {
      ...item,
      entryId,
      shoppingStoreType,
      purchased: itemRecord.purchased === true,
    });
  }
  const shoppingList = [...shoppingListByEntryId.values()];

  const recentLocations = uniquePlaces(record.recentLocations);
  const recentStores = uniquePlaces(record.recentStores);
  const newestFirst = [...items].sort((a, b) => b.createdAt - a.createdAt);
  return {
    items,
    shoppingList,
    recentLocations:
      recentLocations.length > 0
        ? recentLocations
        : uniquePlaces(newestFirst.map((item) => item.location)),
    recentStores:
      recentStores.length > 0
        ? recentStores
        : uniquePlaces(newestFirst.flatMap((item) => item.storeTypes)),
  };
}

export function StockProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [shoppingList, setShoppingList] = useState<BuyListItem[]>([]);
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  const [recentStores, setRecentStores] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loadProblem, setLoadProblem] = useState<LoadProblem | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [savedCopyCount, setSavedCopyCount] = useState(0);
  // The saved text when it couldn't be read at all, kept until it is set aside.
  const unreadableTextRef = useRef<string | null>(null);
  const [canPersist, setCanPersist] = useState(false);
  const currentDataRef = useRef(EMPTY_SAVED_DATA);
  const lastPersistedJsonRef = useRef('');
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const savedData = useMemo(
    () => ({ items, shoppingList, recentLocations, recentStores }),
    [items, shoppingList, recentLocations, recentStores],
  );
  useLayoutEffect(() => {
    currentDataRef.current = savedData;
  }, [savedData]);

  const applySavedData = useCallback((data: SavedData) => {
    setItems(data.items);
    setShoppingList(data.shoppingList);
    setRecentLocations(data.recentLocations);
    setRecentStores(data.recentStores);
  }, []);

  const writeSnapshot = useCallback((data: SavedData) => {
    const payload = JSON.stringify(data);
    const write = writeQueueRef.current
      .catch(() => undefined)
      .then(() => setLocalItem(STORAGE_KEY, payload));
    writeQueueRef.current = write;
    return write;
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Saving stays off for both problems, so the saved copy is never overwritten.
    function stopWith(problem: LoadProblem) {
      if (!isMounted) return;
      setLoadProblem(problem);
      setIsLoading(false);
    }

    async function load() {
      readSavedCopies()
        .then((copies) => {
          if (isMounted) setSavedCopyCount(copies.length);
        })
        .catch(() => undefined);

      let saved: string | null;
      try {
        saved = await getLocalItem(STORAGE_KEY);
      } catch {
        stopWith('read-failed');
        return;
      }

      let local = EMPTY_SAVED_DATA;
      let skipped = 0;
      if (saved) {
        try {
          local = normalizeSavedData(JSON.parse(saved), false, () => {
            skipped += 1;
          });
        } catch {
          unreadableTextRef.current = saved;
          stopWith('unreadable');
          return;
        }
      }

      if (saved && skipped > 0) {
        // Keep the original before the readable part replaces it. If that
        // fails, change nothing and offer Try again: the stock is still there.
        let copyCount: number;
        try {
          copyCount = await keepSavedCopy(saved);
        } catch {
          stopWith('read-failed');
          return;
        }
        if (isMounted) setSavedCopyCount(copyCount);
      }
      if (!isMounted) return;

      if (skipped > 0) {
        setLoadNotice(
          `${skipped} saved ${skipped === 1 ? "item couldn't be read and was" : "items couldn't be read and were"} left out. A copy of the original data was kept on this phone.`,
        );
      }
      lastPersistedJsonRef.current = JSON.stringify(local);
      applySavedData(local);
      await writeSnapshot(local).catch(() => {
        setStorageError(
          'Your stock could not be saved on this device. Please try again.',
        );
      });
      if (isMounted) {
        setCanPersist(true);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [applySavedData, loadAttempt, writeSnapshot]);

  const retryLoad = useCallback(() => {
    setLoadProblem(null);
    setIsLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const startFresh = useCallback(async () => {
    // Set the unreadable text aside first; if that fails, nothing changes.
    const unreadable = unreadableTextRef.current;
    if (unreadable !== null) setSavedCopyCount(await keepSavedCopy(unreadable));
    unreadableTextRef.current = null;
    setLoadProblem(null);
    // Saving turns on, so the persist effect replaces the unreadable copy.
    setCanPersist(true);
  }, []);

  const getRecoveryData = useCallback(async () => {
    if (unreadableTextRef.current !== null) return unreadableTextRef.current;
    const copies = await readSavedCopies();
    return copies.length > 0 ? JSON.stringify(copies, null, 2) : null;
  }, []);

  const deleteSavedCopies = useCallback(async () => {
    await setLocalItem(SAVED_COPIES_KEY, '[]');
    setSavedCopyCount(0);
  }, []);

  const dismissLoadNotice = useCallback(() => setLoadNotice(null), []);

  useEffect(() => {
    if (isLoading || !canPersist) return;
    const dataJson = JSON.stringify(savedData);
    if (dataJson === lastPersistedJsonRef.current) return;

    lastPersistedJsonRef.current = dataJson;
    writeSnapshot(savedData)
      .then(() => setStorageError(null))
      .catch(() => {
        // Forget the failed snapshot so the next change retries the save.
        if (lastPersistedJsonRef.current === dataJson) {
          lastPersistedJsonRef.current = '';
        }
        setStorageError(
          'Your changes could not be saved on this device. Please try again.',
        );
      });
  }, [canPersist, isLoading, savedData, writeSnapshot]);

  const saveItem = useCallback((draft: StockItemDraft, id?: string) => {
    const name = draft.name.trim();
    const existingItem = id
      ? currentDataRef.current.items.find((item) => item.id === id)
      : undefined;
    const baseItemId = itemIdFromName(name);
    const keepingExistingName =
      existingItem !== undefined &&
      itemIdFromName(existingItem.name) === baseItemId;
    const duplicate = currentDataRef.current.items.some(
      (item) =>
        item.id !== existingItem?.id &&
        itemIdFromName(item.name) === baseItemId,
    );
    if (!baseItemId || (duplicate && !keepingExistingName)) return null;
    const itemId = keepingExistingName
      ? existingItem.id
      : assignUniqueItemId(
          name,
          new Set(
            currentDataRef.current.items
              .filter((item) => item.id !== existingItem?.id)
              .map((item) => item.id),
          ),
        );

    // Reuse the spelling other items already use, so "fridge" and "Fridge"
    // count as the same place in stock checks and buy lists.
    const otherItems = currentDataRef.current.items.filter(
      (item) => item.id !== existingItem?.id,
    );
    const location = matchSpelling(
      draft.location,
      otherItems.map((item) => item.location),
    );
    const storeTypes = uniqueNames(
      draft.storeTypes.map((store) =>
        matchSpelling(store, otherItems.flatMap((item) => item.storeTypes)),
      ),
    );
    const savedItem: StockItem = {
      ...draft,
      name,
      location,
      storeTypes,
      id: itemId,
      createdAt: existingItem?.createdAt ?? Date.now(),
    };
    setItems((current) => {
      return existingItem
        ? current.map((item) =>
            item.id === existingItem.id ? savedItem : item,
          )
        : [...current, savedItem];
    });
    if (existingItem) {
      setShoppingList((current) => {
        const entries = new Map<string, BuyListItem>();
        for (const entry of current) {
          if (entry.id !== existingItem.id) {
            entries.set(entry.entryId, entry);
            continue;
          }
          // Keep the entry only while the item is still sold at that store.
          const store = storeTypes.find(
            (candidate) =>
              candidate.toLocaleLowerCase() ===
              entry.shoppingStoreType.toLocaleLowerCase(),
          );
          if (!store) continue;
          entries.set(JSON.stringify([itemId, store]), {
            ...savedItem,
            entryId: JSON.stringify([itemId, store]),
            shoppingStoreType: store,
            purchased: entry.purchased,
          });
        }
        return [...entries.values()];
      });
    }
    setRecentLocations((current) => rememberPlace(location, current));
    setRecentStores((current) =>
      storeTypes.reduce(
        (next, store) => rememberPlace(store, next),
        current,
      ),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return itemId;
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setShoppingList((current) => current.filter((entry) => entry.id !== id));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const createBuyList = useCallback(
    (itemIds: string[], storeType: string) => {
      const byId = new Map(items.map((item) => [item.id, item]));
      const replacementItems = itemIds.flatMap((id) => {
        const item = byId.get(id);
        return item && item.storeTypes.includes(storeType)
          ? [
              {
                ...item,
                entryId: JSON.stringify([item.id, storeType]),
                shoppingStoreType: storeType,
                purchased: false,
              },
            ]
          : [];
      });
      setShoppingList((current) => [
        ...current.filter((item) => item.shoppingStoreType !== storeType),
        ...replacementItems,
      ]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [items],
  );

  const togglePurchased = useCallback((entryId: string) => {
    setShoppingList((current) =>
      current.map((item) =>
        item.entryId === entryId
          ? { ...item, purchased: !item.purchased }
          : item,
      ),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const clearPurchased = useCallback(() => {
    setShoppingList((current) => current.filter((item) => !item.purchased));
  }, []);

  const importBackup = useCallback(
    (data: unknown) => {
      if (loadProblem) throw new Error(IMPORT_BLOCKED[loadProblem]);
      const record = Array.isArray(data) ? {} : asRecord(data);
      const source =
        Array.isArray(data)
          ? data
          : record.items;
      const listSource = Array.isArray(record.shoppingList)
        ? record.shoppingList
        : [];
      const hasSavedSuggestions =
        (Array.isArray(record.recentLocations) &&
          record.recentLocations.length > 0) ||
        (Array.isArray(record.recentStores) &&
          record.recentStores.length > 0);
      if (
        !Array.isArray(source) ||
        (source.length === 0 &&
          listSource.length === 0 &&
          !hasSavedSuggestions)
      ) {
        throw new Error('The JSON does not contain any saved Home Stock data.');
      }

      const normalizedBackup = normalizeSavedData({
        items: source,
        shoppingList: listSource,
        recentLocations: record.recentLocations,
        recentStores: record.recentStores,
      }, true);
      const knownIds = new Set(items.map((item) => item.id));
      const itemsByName = new Map(
        items.map((item) => [itemIdFromName(item.name), item] as const),
      );
      const importedItemIdByName = new Map<string, string>();
      const newItems: StockItem[] = [];
      let skippedCount = 0;
      for (const item of normalizedBackup.items) {
        const nameKey = itemIdFromName(item.name);
        const existing = itemsByName.get(nameKey);
        if (existing) {
          skippedCount += 1;
          importedItemIdByName.set(nameKey, existing.id);
          continue;
        }
        if (knownIds.has(item.id)) {
          skippedCount += 1;
          continue;
        }
        knownIds.add(item.id);
        itemsByName.set(nameKey, item);
        importedItemIdByName.set(nameKey, item.id);
        newItems.push(item);
      }

      const remappedShoppingList = normalizedBackup.shoppingList.map((entry) => {
        const itemId = importedItemIdByName.get(itemIdFromName(entry.name));
        if (!itemId) return entry;
        return {
          ...entry,
          id: itemId,
          entryId: JSON.stringify([itemId, entry.shoppingStoreType]),
        };
      });
      const knownEntryIds = new Set(
        shoppingList.map((entry) => entry.entryId),
      );
      const newShoppingList = remappedShoppingList.filter((entry) => {
        if (knownEntryIds.has(entry.entryId)) {
          return false;
        }
        knownEntryIds.add(entry.entryId);
        return true;
      });

      setItems((current) => [...current, ...newItems]);
      setShoppingList((current) => [...current, ...newShoppingList]);
      setRecentLocations((current) =>
        uniquePlaces([...normalizedBackup.recentLocations, ...current]),
      );
      setRecentStores((current) =>
        uniquePlaces([...normalizedBackup.recentStores, ...current]),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return {
        importedCount: newItems.length,
        skippedCount,
        shoppingListAddedCount: newShoppingList.length,
      };
    },
    [items, loadProblem, shoppingList],
  );

  const value = useMemo(
    () => ({
      ...savedData,
      isLoading,
      // A load problem stays visible until it is fixed.
      storageError: loadProblem ? LOAD_ERRORS[loadProblem] : storageError,
      loadProblem,
      loadNotice,
      dismissLoadNotice,
      retryLoad,
      startFresh,
      savedCopyCount,
      getRecoveryData,
      deleteSavedCopies,
      saveItem,
      deleteItem,
      createBuyList,
      togglePurchased,
      clearPurchased,
      importBackup,
    }),
    [
      savedData,
      isLoading,
      loadProblem,
      loadNotice,
      dismissLoadNotice,
      retryLoad,
      startFresh,
      savedCopyCount,
      getRecoveryData,
      deleteSavedCopies,
      storageError,
      saveItem,
      deleteItem,
      createBuyList,
      togglePurchased,
      clearPurchased,
      importBackup,
    ],
  );

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock() {
  const value = useContext(StockContext);
  if (!value) throw new Error('useStock must be used inside StockProvider.');
  return value;
}