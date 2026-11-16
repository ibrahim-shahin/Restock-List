// Quantity fields accept up to this many digits, so at most 9999.
export const MAX_QUANTITY_DIGITS = 4;

/**
 * Keeps only the digits of typed or pasted text. Arabic-Indic (٠-٩) and
 * Persian (۰-۹) digits, which some Android keyboards type, become 0-9.
 */
export function cleanQuantityInput(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[^0-9]/g, '')
    .slice(0, MAX_QUANTITY_DIGITS);
}
