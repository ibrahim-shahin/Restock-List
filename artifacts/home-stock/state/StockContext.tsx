import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  saveItem: (draft: StockItemDraft, id?: string) => string;
  deleteItem: (id: string) => void;
  createBuyList: (itemIds: string[], storeType: string) => void;
  togglePurchased: (entryId: string) => void;
  clearPurchased: () => void;
  importItems: (data: unknown) => { importedCount: number; skippedCount: number };
};

const STORAGE_KEY = 'home-stock:v1';
const StockContext = createContext<StockContextValue | null>(null);
const MAX_RECENT_PLACES = 10;

function createId() {
  return `${Date.now().toString()}-${Math.random().toString(36).slice(2, 10)}`;
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

  const id = typeof record.id === 'string' && record.id.trim()
    ? record.id
    : imported
      ? createId()
      : '';
  if (!id) throw new Error('A saved item is missing its ID.');

  return {
    id,
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

function normalizeSavedData(value: unknown): SavedData {
  const record = asRecord(value);
  if (!Array.isArray(record.items) || !Array.isArray(record.shoppingList)) {
    throw new Error('Your saved stock has an unexpected format.');
  }

  const items = record.items.map((item, index) =>
    normalizeStockItem(item, false, index),
  );
  const shoppingList = record.shoppingList.map((value) => {
    const itemRecord = asRecord(value);
    const item = normalizeStockItem(value);
    const shoppingStoreType =
      typeof itemRecord.shoppingStoreType === 'string'
        ? itemRecord.shoppingStoreType
        : typeof itemRecord.storeType === 'string'
          ? itemRecord.storeType
          : item.storeTypes[0];
    if (!shoppingStoreType) {
      throw new Error('A saved buy-list item is missing its store.');
    }
    return {
      ...item,
      entryId:
        typeof itemRecord.entryId === 'string'
          ? itemRecord.entryId
          : JSON.stringify([item.id, shoppingStoreType]),
      shoppingStoreType,
      purchased: itemRecord.purchased === true,
    };
  });

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

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!isMounted) return;
        if (value) {
          const parsed = normalizeSavedData(JSON.parse(value));
          setItems(parsed.items);
          setShoppingList(parsed.shoppingList);
          setRecentLocations(parsed.recentLocations);
          setRecentStores(parsed.recentStores);
        }
        setCanPersist(true);
      })
      .catch(() => {
        if (isMounted) {
          setStorageError(
            'Your saved stock could not be opened. Your current changes may not be saved.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading || !canPersist) return;

    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items,
        shoppingList,
        recentLocations,
        recentStores,
      } satisfies SavedData),
    )
      .then(() => setStorageError(null))
      .catch(() => {
        setStorageError(
          'Your changes could not be saved on this device. Please try again.',
        );
      });
  }, [isLoading, canPersist, items, shoppingList, recentLocations, recentStores]);

  const saveItem = useCallback((draft: StockItemDraft, id?: string) => {
    const itemId = id ?? createId();
    setStorageError(null);
    setItems((current) => {
      const existing = id ? current.find((item) => item.id === id) : undefined;
      const savedItem: StockItem = {
        ...draft,
        storeTypes: uniquePlaces(draft.storeTypes),
        id: itemId,
        createdAt: existing?.createdAt ?? Date.now(),
      };
      return existing
        ? current.map((item) => (item.id === id ? savedItem : item))
        : [...current, savedItem];
    });
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

  const importItems = useCallback(
    (data: unknown) => {
      const source =
        Array.isArray(data)
          ? data
          : data && typeof data === 'object'
            ? (data as Record<string, unknown>).items
            : null;
      if (!Array.isArray(source) || source.length === 0) {
        throw new Error('The JSON must contain a non-empty items list.');
      }

      const importedItems = source.map((item) => normalizeStockItem(item, true));
      const knownIds = new Set(items.map((item) => item.id));
      const newItems: StockItem[] = [];
      let skippedCount = 0;
      for (const item of importedItems) {
        if (knownIds.has(item.id)) {
          skippedCount += 1;
          continue;
        }
        knownIds.add(item.id);
        newItems.push(item);
      }

      setStorageError(null);
      setItems((current) => [...current, ...newItems]);
      setRecentLocations((current) =>
        newItems.reduce(
          (next, item) => rememberPlace(item.location, next),
          current,
        ),
      );
      setRecentStores((current) =>
        newItems.reduce(
          (next, item) =>
            item.storeTypes.reduce(
              (places, store) => rememberPlace(store, places),
              next,
            ),
          current,
        ),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { importedCount: newItems.length, skippedCount };
    },
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      shoppingList,
      recentLocations,
      recentStores,
      isLoading,
      storageError,
      saveItem,
      deleteItem,
      createBuyList,
      togglePurchased,
      clearPurchased,
      importItems,
    }),
    [
      items,
      shoppingList,
      recentLocations,
      recentStores,
      isLoading,
      storageError,
      saveItem,
      deleteItem,
      createBuyList,
      togglePurchased,
      clearPurchased,
      importItems,
    ],
  );

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock() {
  const value = useContext(StockContext);
  if (!value) throw new Error('useStock must be used inside StockProvider.');
  return value;
}