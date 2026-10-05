import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getHomeStock,
  saveHomeStock,
} from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';
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
  cloudSyncStatus: 'syncing' | 'synced' | 'error';
  cloudSyncError: string | null;
  syncNow: () => Promise<void>;
  saveItem: (draft: StockItemDraft, id?: string) => string;
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

const STORAGE_KEY = 'home-stock:v1';
const LEGACY_OWNER_KEY = 'home-stock:legacy-owner:v1';
const StockContext = createContext<StockContextValue | null>(null);
const MAX_RECENT_PLACES = 10;
const EMPTY_SAVED_DATA: SavedData = {
  items: [],
  shoppingList: [],
  recentLocations: [],
  recentStores: [],
};

type LocalSnapshot = {
  data: SavedData;
  localUpdatedAt: number;
  cloudUpdatedAt: number;
};

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

function timestampOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readLocalSnapshot(value: string | null): LocalSnapshot | null {
  if (!value) return null;
  const record = asRecord(JSON.parse(value));
  return {
    data: normalizeSavedData(record),
    localUpdatedAt: timestampOrZero(record._localUpdatedAt),
    cloudUpdatedAt: timestampOrZero(record._cloudUpdatedAt),
  };
}

function hasSavedContent(data: SavedData): boolean {
  return (
    data.items.length > 0 ||
    data.shoppingList.length > 0 ||
    data.recentLocations.length > 0 ||
    data.recentStores.length > 0
  );
}

function mergeSavedData(local: SavedData, cloud: SavedData): SavedData {
  const items = new Map<string, StockItem>();
  for (const item of [...local.items, ...cloud.items]) items.set(item.id, item);

  const shoppingList = new Map<string, BuyListItem>();
  for (const entry of [...local.shoppingList, ...cloud.shoppingList]) {
    shoppingList.set(entry.entryId, entry);
  }

  return {
    items: [...items.values()],
    shoppingList: [...shoppingList.values()],
    recentLocations: uniquePlaces([
      ...local.recentLocations,
      ...cloud.recentLocations,
    ]),
    recentStores: uniquePlaces([...local.recentStores, ...cloud.recentStores]),
  };
}

export function StockProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) {
  const accountStorageKey = `${STORAGE_KEY}:account:${userId}`;
  const [items, setItems] = useState<StockItem[]>([]);
  const [shoppingList, setShoppingList] = useState<BuyListItem[]>([]);
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  const [recentStores, setRecentStores] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState<StockContextValue['cloudSyncStatus']>('syncing');
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const localUpdatedAtRef = useRef(0);
  const cloudUpdatedAtRef = useRef(0);
  const currentDataRef = useRef(EMPTY_SAVED_DATA);
  const lastPersistedJsonRef = useRef('');
  const lastCloudSentJsonRef = useRef('');
  const localWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const cloudWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

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

  const writeLocalSnapshot = useCallback(
    (data: SavedData, localUpdatedAt: number, cloudUpdatedAt: number) => {
      const payload = JSON.stringify({
        ...data,
        _localUpdatedAt: localUpdatedAt,
        _cloudUpdatedAt: cloudUpdatedAt,
      });
      const write = localWriteQueueRef.current
        .catch(() => undefined)
        .then(() => AsyncStorage.setItem(accountStorageKey, payload));
      localWriteQueueRef.current = write;
      return write;
    },
    [accountStorageKey],
  );

  const enqueueCloudWrite = useCallback(
    (data: SavedData) => {
      const dataJson = JSON.stringify(data);
      const write = cloudWriteQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          setCloudSyncStatus('syncing');
          const saved = await saveHomeStock({ data });
          const cloudUpdatedAt = saved.updatedAt
            ? Date.parse(saved.updatedAt)
            : Date.now();
          cloudUpdatedAtRef.current = cloudUpdatedAt;
          setCloudSyncStatus('synced');
          setCloudSyncError(null);
          if (JSON.stringify(currentDataRef.current) === dataJson) {
            await writeLocalSnapshot(
              data,
              localUpdatedAtRef.current || Date.now(),
              cloudUpdatedAt,
            );
          }
        });
      cloudWriteQueueRef.current = write;
      return write;
    },
    [writeLocalSnapshot],
  );

  useEffect(() => {
    let isMounted = true;
    let didLoadLocal = false;
    let local = EMPTY_SAVED_DATA;
    let localSnapshot: LocalSnapshot | null = null;
    let isLegacySource = false;

    async function loadAndReconcile() {
      try {
        const [accountValue, legacyOwner, legacyValue] = await Promise.all([
          AsyncStorage.getItem(accountStorageKey),
          AsyncStorage.getItem(LEGACY_OWNER_KEY),
          AsyncStorage.getItem(STORAGE_KEY),
        ]);

        localSnapshot = readLocalSnapshot(accountValue);
        if (localSnapshot) {
          local = localSnapshot.data;
        } else if (!legacyOwner && legacyValue) {
          local = normalizeSavedData(JSON.parse(legacyValue));
          isLegacySource = true;
        }
        didLoadLocal = true;

        let remote;
        try {
          remote = await getHomeStock();
        } catch {
          if (!isMounted) return;
          const localUpdatedAt =
            localSnapshot?.localUpdatedAt || Date.now();
          localUpdatedAtRef.current = localUpdatedAt;
          lastPersistedJsonRef.current = JSON.stringify(local);
          applySavedData(local);
          await writeLocalSnapshot(
            local,
            localUpdatedAt,
            localSnapshot?.cloudUpdatedAt ?? 0,
          ).catch(() => {
            setStorageError(
              'Your stock could not be saved on this device. Please try again.',
            );
          });
          await AsyncStorage.setItem(LEGACY_OWNER_KEY, userId).catch(() => {});
          setCloudSyncStatus('error');
          setCloudSyncError(
            'Could not reach cloud sync. Your stock remains on this device; try syncing again when you are online.',
          );
          setCanPersist(true);
          setIsLoading(false);
          return;
        }

        const cloud = remote.data
          ? normalizeSavedData(remote.data)
          : null;
        const remoteUpdatedAt = remote.updatedAt
          ? Date.parse(remote.updatedAt)
          : 0;
        let chosen = local;
        let shouldUpload = cloud === null;

        if (cloud) {
          if (isLegacySource) {
            chosen = mergeSavedData(local, cloud);
            shouldUpload = true;
          } else if (
            localSnapshot &&
            localSnapshot.localUpdatedAt > localSnapshot.cloudUpdatedAt
          ) {
            chosen =
              localSnapshot.cloudUpdatedAt > 0 &&
              remoteUpdatedAt > localSnapshot.cloudUpdatedAt
                ? mergeSavedData(local, cloud)
                : local;
            shouldUpload = true;
          } else if (
            localSnapshot &&
            localSnapshot.localUpdatedAt === 0 &&
            localSnapshot.cloudUpdatedAt === 0 &&
            hasSavedContent(local)
          ) {
            chosen = mergeSavedData(local, cloud);
            shouldUpload = true;
          } else {
            chosen = cloud;
          }
        }

        const chosenJson = JSON.stringify(chosen);
        const localUpdatedAt = shouldUpload
          ? chosenJson !== JSON.stringify(local) || !localSnapshot
            ? Date.now()
            : localSnapshot.localUpdatedAt || Date.now()
          : remoteUpdatedAt || Date.now();
        localUpdatedAtRef.current = localUpdatedAt;
        cloudUpdatedAtRef.current = remoteUpdatedAt;
        lastPersistedJsonRef.current = chosenJson;
        applySavedData(chosen);

        if (shouldUpload) {
          try {
            const saved = await saveHomeStock({ data: chosen });
            cloudUpdatedAtRef.current = saved.updatedAt
              ? Date.parse(saved.updatedAt)
              : Date.now();
            lastCloudSentJsonRef.current = chosenJson;
            setCloudReady(true);
            setCloudSyncStatus('synced');
            setCloudSyncError(null);
          } catch {
            setCloudReady(false);
            setCloudSyncStatus('error');
            setCloudSyncError(
              'Could not save the cloud copy. Your stock remains on this device; tap Sync now to retry.',
            );
          }
        } else {
          lastCloudSentJsonRef.current = chosenJson;
          setCloudReady(true);
          setCloudSyncStatus('synced');
          setCloudSyncError(null);
        }

        await writeLocalSnapshot(
          chosen,
          localUpdatedAt,
          cloudUpdatedAtRef.current,
        ).catch(() => {
          setStorageError(
            'Your stock could not be saved on this device. Please try again.',
          );
        });
        await AsyncStorage.setItem(LEGACY_OWNER_KEY, userId).catch(() => {});
        if (isMounted) {
          setCanPersist(true);
          setIsLoading(false);
        }
      } catch {
        if (!isMounted) return;
        if (didLoadLocal) {
          const localUpdatedAt =
            localSnapshot?.localUpdatedAt || Date.now();
          localUpdatedAtRef.current = localUpdatedAt;
          lastPersistedJsonRef.current = JSON.stringify(local);
          applySavedData(local);
          await writeLocalSnapshot(
            local,
            localUpdatedAt,
            localSnapshot?.cloudUpdatedAt ?? 0,
          ).catch(() => {});
          await AsyncStorage.setItem(LEGACY_OWNER_KEY, userId).catch(() => {});
          setCloudSyncStatus('error');
          setCloudSyncError(
            'Could not reconcile your cloud copy. Your existing stock was kept on this device.',
          );
          setCanPersist(true);
        } else {
          setStorageError(
            'Your saved stock could not be opened. Your current changes may not be saved.',
          );
        }
        setIsLoading(false);
      }
    }

    void loadAndReconcile();

    return () => {
      isMounted = false;
    };
  }, [
    accountStorageKey,
    applySavedData,
    userId,
    writeLocalSnapshot,
  ]);

  useEffect(() => {
    if (isLoading || !canPersist) return;
    const dataJson = JSON.stringify(savedData);
    if (dataJson === lastPersistedJsonRef.current) return;

    const localUpdatedAt = Date.now();
    localUpdatedAtRef.current = localUpdatedAt;
    lastPersistedJsonRef.current = dataJson;
    writeLocalSnapshot(savedData, localUpdatedAt, cloudUpdatedAtRef.current)
      .then(() => setStorageError(null))
      .catch(() => {
        setStorageError(
          'Your changes could not be saved on this device. Please try again.',
        );
      });
  }, [canPersist, isLoading, savedData, writeLocalSnapshot]);

  useEffect(() => {
    if (!canPersist || !cloudReady) return;
    const dataJson = JSON.stringify(savedData);
    if (dataJson === lastCloudSentJsonRef.current) return;

    const timeout = setTimeout(() => {
      lastCloudSentJsonRef.current = dataJson;
      void enqueueCloudWrite(savedData).catch(() => {
        setCloudSyncStatus('error');
        setCloudSyncError(
          'Cloud sync failed. Your changes are still saved on this device; tap Sync now to retry.',
        );
      });
    }, 650);

    return () => clearTimeout(timeout);
  }, [canPersist, cloudReady, enqueueCloudWrite, savedData]);

  const syncNow = useCallback(async () => {
    if (!canPersist) return;
    setCloudSyncStatus('syncing');
    setCloudSyncError(null);

    try {
      if (cloudReady) {
        const snapshot = currentDataRef.current;
        lastCloudSentJsonRef.current = JSON.stringify(snapshot);
        await enqueueCloudWrite(snapshot);
        return;
      }

      const remote = await getHomeStock();
      const cloud = remote.data ? normalizeSavedData(remote.data) : null;
      const current = currentDataRef.current;
      const merged = cloud ? mergeSavedData(current, cloud) : current;
      const mergedJson = JSON.stringify(merged);
      if (mergedJson !== JSON.stringify(current)) {
        applySavedData(merged);
        localUpdatedAtRef.current = Date.now();
        lastPersistedJsonRef.current = mergedJson;
      }

      const saved = await saveHomeStock({ data: merged });
      cloudUpdatedAtRef.current = saved.updatedAt
        ? Date.parse(saved.updatedAt)
        : Date.now();
      setCloudReady(true);
      setCloudSyncStatus('synced');
      setCloudSyncError(null);
      lastCloudSentJsonRef.current = mergedJson;
      await writeLocalSnapshot(
        merged,
        localUpdatedAtRef.current || Date.now(),
        cloudUpdatedAtRef.current,
      );
    } catch {
      setCloudSyncStatus('error');
      setCloudSyncError(
        'Cloud sync failed. Your changes remain on this device; try again when you are online.',
      );
    }
  }, [
    applySavedData,
    canPersist,
    cloudReady,
    enqueueCloudWrite,
    writeLocalSnapshot,
  ]);

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

  const importBackup = useCallback(
    (data: unknown) => {
      const record = Array.isArray(data) ? {} : asRecord(data);
      const source =
        Array.isArray(data)
          ? data
          : record.items;
      if (!Array.isArray(source) || source.length === 0) {
        throw new Error('The JSON must contain a non-empty items list.');
      }

      const importedItems = source.map((item) =>
        normalizeStockItem(item, true),
      );
      const normalizedBackup = normalizeSavedData({
        items: importedItems,
        shoppingList: Array.isArray(record.shoppingList)
          ? record.shoppingList
          : [],
        recentLocations: record.recentLocations,
        recentStores: record.recentStores,
      });
      const knownIds = new Set(items.map((item) => item.id));
      const newItems: StockItem[] = [];
      let skippedCount = 0;
      for (const item of normalizedBackup.items) {
        if (knownIds.has(item.id)) {
          skippedCount += 1;
          continue;
        }
        knownIds.add(item.id);
        newItems.push(item);
      }

      const availableIds = new Set([
        ...items.map((item) => item.id),
        ...newItems.map((item) => item.id),
      ]);
      const knownEntryIds = new Set(
        shoppingList.map((entry) => entry.entryId),
      );
      const newShoppingList = normalizedBackup.shoppingList.filter((entry) => {
        if (!availableIds.has(entry.id) || knownEntryIds.has(entry.entryId)) {
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
      cloudSyncStatus,
      cloudSyncError,
      syncNow,
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
      cloudSyncStatus,
      cloudSyncError,
      syncNow,
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