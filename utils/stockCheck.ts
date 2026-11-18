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

const placeKey = (place: string) => place.trim().toLocaleLowerCase();
const compareText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * Items in the order to check them: grouped by storage place, so each
 * place is checked in one go instead of walking back and forth. Places are
 * alphabetical, and so are the items within a place.
 */
export function orderByPlace<T extends Placed>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => compareText(a.location, b.location) || compareText(a.name, b.name),
  );
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
