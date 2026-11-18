import type { StockItem } from '@/state/StockContext';
import { matchesSearch, normalizeForSearch } from '../search';

function item(overrides: Partial<StockItem>): StockItem {
  return {
    id: 'x',
    name: 'Item',
    minimumQuantity: 1,
    restockQuantity: 1,
    unit: '',
    location: 'Pantry',
    storeTypes: ['Supermarket'],
    createdAt: 1,
    ...overrides,
  };
}

describe('normalizeForSearch', () => {
  it('ignores case and accents', () => {
    expect(normalizeForSearch('  Café CRÈME ')).toBe('cafe creme');
  });

  it('folds Arabic letter variants and removes vowel marks and tatweel', () => {
    expect(normalizeForSearch('أرز')).toBe('ارز'); // hamza alef -> alef
    expect(normalizeForSearch('إبرة')).toBe('ابره'); // hamza below, teh marbuta
    expect(normalizeForSearch('مستشفى')).toBe('مستشفي'); // alef maqsura
    expect(normalizeForSearch('شَاي')).toBe('شاي'); // fatha removed
    expect(normalizeForSearch('شـاي')).toBe('شاي'); // tatweel removed
  });

  it('reads Arabic-Indic and Persian digits as 0-9', () => {
    expect(normalizeForSearch('١٢ ۳')).toBe('12 3');
  });
});

describe('matchesSearch', () => {
  const milk = item({ name: 'Whole Milk', unit: 'L', location: 'Fridge', storeTypes: ['Supermarket', 'Corner shop'] });

  it('matches everything when the search is empty', () => {
    expect(matchesSearch(milk, '   ')).toBe(true);
  });

  it('matches the name, place, unit and stores', () => {
    expect(matchesSearch(milk, 'milk')).toBe(true);
    expect(matchesSearch(milk, 'fridge')).toBe(true);
    expect(matchesSearch(milk, 'corner')).toBe(true);
    expect(matchesSearch(milk, 'rice')).toBe(false);
  });

  it('matches the note too', () => {
    expect(matchesSearch({ ...milk, note: 'Almarai full fat' }, 'almarai')).toBe(true);
  });

  it('needs every word to match, in any order', () => {
    expect(matchesSearch(milk, 'fridge whole')).toBe(true);
    expect(matchesSearch(milk, 'fridge rice')).toBe(false);
  });

  it('finds Arabic names written with or without hamza', () => {
    const rice = item({ name: 'أرز بسمتي' });
    expect(matchesSearch(rice, 'ارز')).toBe(true);
  });
});
