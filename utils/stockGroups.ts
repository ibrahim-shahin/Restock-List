import { orderPlaces, placeKey } from './stockCheck';

export type GroupBy = 'none' | 'place' | 'store';

type Groupable = { location: string; storeTypes: string[] };

export type ItemGroup<T> = { key: string; title: string; items: T[] };

/**
 * Items in groups for the Stock screen, keeping their order within each.
 * By place: in the order of your stock-check route, then A to Z, with
 * places that differ only in case or accents as one. By store: A to Z, and
 * an item sold at several stores shows under each. Without grouping, one
 * untitled group with every item.
 */
export function groupStockItems<T extends Groupable>(
  items: T[],
  groupBy: GroupBy,
  placeOrder: string[] = [],
): ItemGroup<T>[] {
  if (groupBy === 'place') {
    return orderPlaces(items.map((item) => item.location), placeOrder).map((place) => ({
      key: `place:${placeKey(place)}`,
      title: place,
      items: items.filter((item) => placeKey(item.location) === placeKey(place)),
    }));
  }
  if (groupBy === 'store') {
    const stores = new Map<string, string>();
    for (const store of items.flatMap((item) => item.storeTypes)) {
      const key = placeKey(store);
      if (key && !stores.has(key)) stores.set(key, store);
    }
    return [...stores.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(([key, store]) => ({
        key: `store:${key}`,
        title: store,
        items: items.filter((item) => item.storeTypes.some((candidate) => placeKey(candidate) === key)),
      }));
  }
  return [{ key: 'all', title: '', items }];
}
