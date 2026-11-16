import type { StockItem } from '@/state/StockContext';

// Marks left over after NFKD decomposition: Latin accents (U+0300-036F) and
// Arabic vowel and Quranic marks (U+0610-061A, U+064B-065F, U+0670, U+06D6-06ED).
const COMBINING_MARKS = /[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const TATWEEL = /\u0640/g;

/**
 * Text as search compares it: lowercase, without accents or Arabic vowel
 * marks, with Arabic letter variants folded and Arabic-Indic digits as 0-9.
 * NFKD already turns hamza forms such as أ إ آ ؤ ئ into their base letters.
 * So "Café" finds "cafe", and "أرز" finds "ارز".
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(TATWEEL, '')
    .replace(/ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .toLocaleLowerCase()
    .trim();
}

/** True when every word of the query appears in the item's name, place, unit or stores. */
export function matchesSearch(item: StockItem, query: string): boolean {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeForSearch(
    [item.name, item.location, item.unit, ...item.storeTypes].join(' '),
  );
  return words.every((word) => text.includes(word));
}
