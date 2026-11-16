import * as Haptics from 'expo-haptics';
import { getLocalItem, setLocalItem } from './localStore';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

type SavedData = {
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
  importBackup: (data: unknown) => {
    importedCount: number;
    skippedCount: number;
    shoppingListAddedCount: number;
  };
};

// The key dates from when guest stock was stored apart from account stock.
// It is kept so stock already saved under it keeps loading.
const STORAGE_KEY = 'home-stock:guest:v1';
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

function uniquePlaces(values: unknown): string[] {
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
    })
    .slice(0, MAX_RECENT_PLACES);
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
  return uniquePlaces(values);
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
  const minimumQuantity = Number(record.minimumQuantity);
  const restockQuantity = Number(record.restockQuantity);

  if (
    !name ||
    !location ||
    storeTypes.length === 0 ||
    !Number.isInteger(minimumQuantity) ||
    minimumQuantity < 0 ||
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

function normalizeSavedData(value: unknown, imported = false): SavedData {
  const record = asRecord(value);
  if (!Array.isArray(record.items) || !Array.isArray(record.shoppingList)) {
    throw new Error('Your saved stock has an unexpected format.');
  }

  const usedItemIds = new Set<string>();
  const itemIdBySourceId = new Map<string, string>();
  const items = record.items.map((value, index) => {
    const itemRecord = asRecord(value);
    const name = typeof itemRecord.name === 'string' ? itemRecord.name.trim() : '';
    const id = assignUniqueItemId(name, usedItemIds);
    if (typeof itemRecord.id === 'string' && !itemIdBySourceId.has(itemRecord.id)) {
      itemIdBySourceId.set(itemRecord.id, id);
    }
    return normalizeStockItem(value, imported, index, id);
  });
  const shoppingListByEntryId = new Map<string, BuyListItem>();
  record.shoppingList.forEach((value) => {
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
  });
  const shoppingList = [...shoppingListByEntryId.values()];

  const recentLocations = uniquePlaces(record.recentLocations);
  const recentStores = uniquePlaces(record.recentStores);
  return {
    items,
    shoppingList,
    recentLocations:
      recentLocations.length > 0
        ? recentLocations
        : [...items].sort((a, b) => b.createdAt - a.createdAt).map((item) => item.location).filter((place, index, all) => all.indexOf(place) === index).slice(0, MAX_RECENT_PLACES),
    recentStores:
      recentStores.length > 0
        ? recentStores
        : [...items].sort((a, b) => b.createdAt - a.createdAt).flatMap((item) => item.storeTypes).filter((place, index, all) => all.findIndex((candidate) => candidate.toLocaleLowerCase() === place.toLocaleLowerCase()) === index).slice(0, MAX_RECENT_PLACES),
  };
}

export function StockProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [shoppingList, setShoppingList] = useState<BuyListItem[]>([]);
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  const [recentStores, setRecentStores] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [canPersist, setCanPersist] = useState(false);
  const currentDataRef = useRef(EMPTY_SAVED_DATA);
  const lastPersistedJsonRef = useRef('');
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const savedData = useMemo(
    () => ({ items, shoppingList, recentLocations, recentStores }),
    [items, shoppingList, recentLocations, recentStores],
  );
  currentDataRef.current = savedData;

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

    async function load() {
      let local = EMPTY_SAVED_DATA;
      try {
        const saved = await getLocalItem(STORAGE_KEY);
        if (saved) local = normalizeSavedData(JSON.parse(saved));
      } catch {
        // Saving stays off, so the unreadable copy is not overwritten.
        if (isMounted) {
          setStorageError(
            'Your saved stock could not be opened. Your current changes may not be saved.',
          );
          setIsLoading(false);
        }
        return;
      }
      if (!isMounted) return;

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
  }, [applySavedData, writeSnapshot]);

  useEffect(() => {
    if (isLoading || !canPersist) return;
    const dataJson = JSON.stringify(savedData);
    if (dataJson === lastPersistedJsonRef.current) return;

    lastPersistedJsonRef.current = dataJson;
    writeSnapshot(savedData)
      .then(() => setStorageError(null))
      .catch(() => {
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

    setStorageError(null);
    const savedItem: StockItem = {
      ...draft,
      name,
      storeTypes: uniquePlaces(draft.storeTypes),
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
          const updatedEntry =
            entry.id === existingItem.id
              ? {
                  ...savedItem,
                  entryId: JSON.stringify([itemId, entry.shoppingStoreType]),
                  shoppingStoreType: entry.shoppingStoreType,
                  purchased: entry.purchased,
                }
              : entry;
          entries.set(updatedEntry.entryId, updatedEntry);
        }
        return [...entries.values()];
      });
    }
    setRecentLocations((current) => rememberPlace(draft.location, current));
    setRecentStores((current) =>
      draft.storeTypes.reduce(
        (next, store) => rememberPlace(store, next),
        current,
      ),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return itemId;
  }, []);

  const deleteItem = useCallback((id: string) => {
    setStorageError(null);
    setItems((current) => current.filter((item) => item.id !== id));
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
      setStorageError(null);
      setShoppingList((current) => [
        ...current.filter((item) => item.shoppingStoreType !== storeType),
        ...replacementItems,
      ]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [items],
  );

  const togglePurchased = useCallback((entryId: string) => {
    setStorageError(null);
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
    setStorageError(null);
    setShoppingList((current) => current.filter((item) => !item.purchased));
  }, []);

  const importBackup = useCallback(
    (data: unknown) => {
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

      setStorageError(null);
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
    [items, shoppingList],
  );

  const value = useMemo(
    () => ({
      ...savedData,
      isLoading,
      storageError,
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