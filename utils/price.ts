// Prices are optional: an item without one is left out of totals.

// Two decimals for most currencies, three for ones like the dinar.
export type PriceDecimals = 2 | 3;

const MAX_PRICE = 1_000_000;
const MAX_WHOLE_DIGITS = 6;
// Prices are kept to the thousandth, whichever decimals are shown.
const KEPT_DECIMALS = 3;

/**
 * The amount in whole hundredths (decimals 2) or thousandths (decimals 3),
 * rounding halves up as the number is written: 1.255 is 126 hundredths even
 * though it is stored as 1.25499...
 */
function toUnits(amount: number, decimals: number): number {
  const shifted = Number(`${amount}e${decimals}`);
  return Math.round(Number.isFinite(shifted) ? shifted : amount * 10 ** decimals);
}

/**
 * Keeps a price as it is typed: digits and one decimal point, with at most
 * `decimals` decimals. Arabic-Indic and Persian digits become 0-9, and a
 * comma or the Arabic decimal separator (٫) becomes a point.
 */
export function cleanPriceInput(text: string, decimals: PriceDecimals = 2): string {
  const normalized = text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[,٫]/g, '.')
    .replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = normalized.split('.');
  const cleanWhole = whole.slice(0, MAX_WHOLE_DIGITS);
  return rest.length === 0 ? cleanWhole : `${cleanWhole}.${rest.join('').slice(0, decimals)}`;
}

/** A valid price rounded to the thousandth, or undefined. */
export function readPrice(value: unknown): number | undefined {
  const price = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    return undefined;
  }
  return toUnits(price, KEPT_DECIMALS) / 10 ** KEPT_DECIMALS;
}

/** The price as shown in a form field: "3.5", "12", or empty. */
export function priceInputValue(price: number | undefined): string {
  return price === undefined ? '' : String(price);
}

/** Like "3.50 JD", or "3.500 JD" with three decimals; just the number without a currency. */
export function formatPrice(amount: number, currency: string, decimals: PriceDecimals = 2): string {
  const text = (toUnits(amount, decimals) / 10 ** decimals).toFixed(decimals);
  const label = currency.trim();
  return label ? `${text} ${label}` : text;
}

// Without an amount, a line counts as one.
type Priced = { price?: number; restockQuantity?: number; purchased?: boolean };

/** The cost of one buy-list line, or undefined without a price. */
export function lineTotal(entry: Priced): number | undefined {
  if (entry.price === undefined) return undefined;
  return Math.round(toUnits(entry.price, KEPT_DECIMALS) * (entry.restockQuantity ?? 1)) / 10 ** KEPT_DECIMALS;
}

/** The estimated cost of what is still to buy, and how many of those lines have no price. */
export function estimateTotal(entries: Priced[]): { total: number; unpriced: number } {
  let units = 0;
  let unpriced = 0;
  for (const entry of entries) {
    if (entry.purchased) continue;
    const line = lineTotal(entry);
    if (line === undefined) unpriced += 1;
    else units += toUnits(line, KEPT_DECIMALS);
  }
  return { total: units / 10 ** KEPT_DECIMALS, unpriced };
}
