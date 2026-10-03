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
  storeType: string;
};

export type StockItemDraft = Omit<StockItem, 'id'>;

export type BuyListItem = StockItem & {
  purchased: boolean;
};

type SavedData = {
  items: StockItem[];
  shoppingList: BuyListItem[];
};

type StockContextValue = SavedData & {
  isLoading: boolean;
  storageError: string | null;
  saveItem: (draft: StockItemDraft, id?: string) => string;
  deleteItem: (id: string) => void;
  createBuyList: (itemIds: string[], storeType: string) => void;
  togglePurchased: (id: string) => void;
  clearPurchased: () => void;
};

const STORAGE_KEY = 'home-stock:v1';
const StockContext = createContext<StockContextValue | null>(null);

function createId() {
  return `${Date.now().toString()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSavedData(value: unknown): value is SavedData {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.items) && Array.isArray(record.shoppingList);
}

export function StockProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [shoppingList, setShoppingList] = useState<BuyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!isMounted) return;
        if (value) {
          const parsed: unknown = JSON.parse(value);
          if (!isSavedData(parsed)) {
            throw new Error('Saved stock data has an unexpected format.');
          }
          setItems(parsed.items);
          setShoppingList(parsed.shoppingList);
        }
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
    if (isLoading) return;

    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items, shoppingList } satisfies SavedData),
    )
      .then(() => setStorageError(null))
      .catch(() => {
        setStorageError(
          'Your changes could not be saved on this device. Please try again.',
        );
      });
  }, [isLoading, items, shoppingList]);

  const saveItem = useCallback((draft: StockItemDraft, id?: string) => {
    const itemId = id ?? createId();
    setStorageError(null);
    setItems((current) => {
      if (id) {
        return current.map((item) =>
          item.id === id ? { ...draft, id } : item,
        );
      }
      return [...current, { ...draft, id: itemId }];
    });
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
        return item && item.storeType === storeType
          ? [{ ...item, purchased: false }]
          : [];
      });
      setStorageError(null);
      setShoppingList((current) => [
        ...current.filter((item) => item.storeType !== storeType),
        ...replacementItems,
      ]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [items],
  );

  const togglePurchased = useCallback((id: string) => {
    setStorageError(null);
    setShoppingList((current) =>
      current.map((item) =>
        item.id === id ? { ...item, purchased: !item.purchased } : item,
      ),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const clearPurchased = useCallback(() => {
    setStorageError(null);
    setShoppingList((current) => current.filter((item) => !item.purchased));
  }, []);

  const value = useMemo(
    () => ({
      items,
      shoppingList,
      isLoading,
      storageError,
      saveItem,
      deleteItem,
      createBuyList,
      togglePurchased,
      clearPurchased,
    }),
    [
      items,
      shoppingList,
      isLoading,
      storageError,
      saveItem,
      deleteItem,
      createBuyList,
      togglePurchased,
      clearPurchased,
    ],
  );

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock() {
  const value = useContext(StockContext);
  if (!value) throw new Error('useStock must be used inside StockProvider.');
  return value;
}