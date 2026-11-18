import {
  cleanPriceInput,
  estimateTotal,
  formatPrice,
  lineTotal,
  priceInputValue,
  readPrice,
} from '../price';

describe('cleanPriceInput', () => {
  it('keeps digits and one decimal point with up to two decimals', () => {
    expect(cleanPriceInput('3.50')).toBe('3.50');
    expect(cleanPriceInput('3.456')).toBe('3.45');
    expect(cleanPriceInput('1.2.3')).toBe('1.23');
    expect(cleanPriceInput('JD 4')).toBe('4');
    expect(cleanPriceInput('1234567')).toBe('123456');
  });

  it('keeps three decimals for currencies like the dinar', () => {
    expect(cleanPriceInput('0.3456', 3)).toBe('0.345');
    expect(cleanPriceInput('1,25', 3)).toBe('1.25');
  });

  it('reads commas, the Arabic decimal separator and Arabic digits', () => {
    expect(cleanPriceInput('2,75')).toBe('2.75');
    expect(cleanPriceInput('٣٫٥')).toBe('3.5');
    expect(cleanPriceInput('۱۲')).toBe('12');
  });
});

describe('readPrice', () => {
  it('accepts numbers and number text, rounded to the thousandth', () => {
    expect(readPrice(1.255)).toBe(1.255);
    expect(readPrice(3.4567)).toBe(3.457);
    expect(readPrice(1.0005)).toBe(1.001);
    expect(readPrice(1000.0005)).toBe(1000.001);
    expect(readPrice('2.5')).toBe(2.5);
    expect(readPrice(0)).toBe(0);
  });

  it('rejects anything else', () => {
    expect(readPrice('')).toBeUndefined();
    expect(readPrice('abc')).toBeUndefined();
    expect(readPrice(-1)).toBeUndefined();
    expect(readPrice(5_000_000)).toBeUndefined();
    expect(readPrice(null)).toBeUndefined();
    expect(readPrice(Number.NaN)).toBeUndefined();
  });
});

describe('showing prices', () => {
  it('formats with two decimals and the currency label', () => {
    expect(formatPrice(3.5, 'JD')).toBe('3.50 JD');
    expect(formatPrice(12, '  ')).toBe('12.00');
    expect(priceInputValue(3.5)).toBe('3.5');
    expect(priceInputValue(undefined)).toBe('');
  });

  it('rounds halves up, at any size', () => {
    expect(formatPrice(1.255, '')).toBe('1.26');
    expect(formatPrice(1.005, '')).toBe('1.01');
    expect(formatPrice(1000.005, '')).toBe('1000.01');
    expect(formatPrice(1.254, '')).toBe('1.25');
  });

  it('shows three decimals when asked', () => {
    expect(formatPrice(3.5, 'JD', 3)).toBe('3.500 JD');
    expect(formatPrice(0.375, 'JD', 3)).toBe('0.375 JD');
    expect(formatPrice(0.375, 'JD', 2)).toBe('0.38 JD');
  });

  it('adds up what is still to buy and counts lines without a price', () => {
    const entries = [
      { price: 1.1, restockQuantity: 3 },
      { price: 0.7, restockQuantity: 1 },
      { restockQuantity: 2 },
      { price: 50, restockQuantity: 1, purchased: true },
    ];
    expect(lineTotal(entries[0])).toBe(3.3);
    expect(lineTotal(entries[2])).toBeUndefined();
    expect(estimateTotal(entries)).toEqual({ total: 4, unpriced: 1 });
  });

  it('keeps thousandths in totals', () => {
    expect(lineTotal({ price: 0.125, restockQuantity: 3 })).toBe(0.375);
    expect(estimateTotal([{ price: 0.125, restockQuantity: 3 }, { price: 1.005, restockQuantity: 1 }])).toEqual({
      total: 1.38,
      unpriced: 0,
    });
  });
});
