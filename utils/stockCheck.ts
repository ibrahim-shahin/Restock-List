import { normalizeForSearch } from '@/utils/search';

// A stock check asks about each item in turn. answers[i] is true when the
// i-th item has enough, so answers.length is also the current item's index.

export function nextAnswers(answers: boolean[], hasEnough: boolean, total: number): boolean[] {
  return answers.length >= total ? answers : [...answers, hasEnough];
}

export function previousAnswers(answers: boolean[]): boolean[] {
  return answers.slice(0, -1);
}

export function shortItemIds(itemIds: string[], answers: boolean[]): string[] {
  return itemIds.filter((_, index) => answers[index] === false);
}

type Placed = { name: string; location: string };

// Places that differ only in case, accents or Arabic spelling variants are one place.
const placeKey = (place: string) => normalizeForSearch(place);
const compareText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

function placeRanks(placeOrder: string[]): Map<string, number> {
  const ranks = new Map<string, number>();
  placeOrder.forEach((place, index) => {
    const key = placeKey(place);
    if (!ranks.has(key)) ranks.set(key, index);
  });
  return ranks;
}

function comparePlaces(ranks: Map<string, number>, a: string, b: string): number {
  const keyA = placeKey(a);
  const keyB = placeKey(b);
  if (keyA === keyB) return 0;
  const rankA = ranks.get(keyA) ?? Number.MAX_SAFE_INTEGER;
  const rankB = ranks.get(keyB) ?? Number.MAX_SAFE_INTEGER;
  // The last step keeps different places apart even when they sort the same.
  return rankA - rankB || compareText(a, b) || (keyA < keyB ? -1 : 1);
}

/**
 * Items in the order to check them: grouped by storage place, so each
 * place is checked in one go instead of walking back and forth. Places
 * follow `placeOrder` (your route, set in Settings), then any others
 * alphabetically; the items within a place are alphabetical.
 */
export function orderByPlace<T extends Placed>(items: T[], placeOrder: string[] = []): T[] {
  const ranks = placeRanks(placeOrder);
  return [...items].sort(
    (a, b) => comparePlaces(ranks, a.location, b.location) || compareText(a.name, b.name),
  );
}

/** Each place once (ignoring case), in route order, then alphabetically. */
export function orderPlaces(places: string[], placeOrder: string[] = []): string[] {
  const seen = new Set<string>();
  const unique = places.filter((place) => {
    const key = placeKey(place);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ranks = placeRanks(placeOrder);
  return unique.sort((a, b) => comparePlaces(ranks, a, b));
}

/** The order with the place at `index` moved one step up (-1) or down (1). */
export function movePlace(order: string[], index: number, step: -1 | 1): string[] {
  const target = index + step;
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export type PlaceProgress = {
  place: string;
  // 1-based position of the item within its place.
  position: number;
  count: number;
  // The place that comes after this one, or null for the last place.
  nextPlace: string | null;
};

/** Where the item at `index` is kept, and how far through that place the check is. */
export function placeProgress(items: Placed[], index: number): PlaceProgress | null {
  const current = items[index];
  if (!current) return null;
  const key = placeKey(current.location);
  let start = index;
  while (start > 0 && placeKey(items[start - 1].location) === key) start -= 1;
  let end = index;
  while (end < items.length - 1 && placeKey(items[end + 1].location) === key) end += 1;
  return {
    place: current.location,
    position: index - start + 1,
    count: end - start + 1,
    nextPlace: end + 1 < items.length ? items[end + 1].location : null,
  };
}
