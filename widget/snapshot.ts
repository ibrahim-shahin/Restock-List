import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLOR_THEMES, type ColorThemeKey } from '@/constants/colors';
import type { Settings, ThemeSetting } from '@/state/Settings';
import type { BuyListItem } from '@/state/StockContext';
import { itemEmoji } from '@/utils/emoji';
import { estimateTotal, formatPrice } from '@/utils/price';

// Android's widget handler can run while the app is closed, so the widget
// reads a small summary the app saves whenever the buy list changes.
const SNAPSHOT_KEY = 'home-stock:widget:v1';
export const WIDGET_NAME = 'BuyList';
const MAX_LINES = 8;

export type WidgetLine = { emoji: string; name: string; amount: string };

export type WidgetSnapshot = {
  // The first few things still to buy, in buy-list order.
  lines: WidgetLine[];
  toBuy: number;
  // "About 12.50 JD", when prices are on.
  estimate?: string;
  colorTheme: ColorThemeKey;
  theme: ThemeSetting;
};

type WidgetSettings = Pick<Settings, 'showPrices' | 'currency' | 'priceDecimals' | 'colorTheme' | 'theme'>;

export function buildWidgetSnapshot(shoppingList: BuyListItem[], settings: WidgetSettings): WidgetSnapshot {
  const remaining = shoppingList.filter((entry) => !entry.purchased);
  const estimate = settings.showPrices ? estimateTotal(remaining) : null;
  return {
    lines: remaining.slice(0, MAX_LINES).map((entry) => ({
      emoji: itemEmoji(entry),
      name: entry.name,
      amount: `${entry.restockQuantity}${entry.unit ? ` ${entry.unit}` : ''}`,
    })),
    toBuy: remaining.length,
    ...(estimate && estimate.total > 0
      ? { estimate: `About ${formatPrice(estimate.total, settings.currency, settings.priceDecimals)}` }
      : {}),
    colorTheme: settings.colorTheme,
    theme: settings.theme,
  };
}

export async function saveWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

/** The saved summary, or null when the app hasn't saved one yet or it can't be read. */
export async function loadWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const value: unknown = JSON.parse((await AsyncStorage.getItem(SNAPSHOT_KEY)) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<WidgetSnapshot>;
    return {
      lines: Array.isArray(record.lines)
        ? record.lines.filter(
            (line): line is WidgetLine =>
              typeof line?.name === 'string' && typeof line?.emoji === 'string' && typeof line?.amount === 'string',
          )
        : [],
      toBuy: typeof record.toBuy === 'number' && record.toBuy >= 0 ? record.toBuy : 0,
      ...(typeof record.estimate === 'string' ? { estimate: record.estimate } : {}),
      colorTheme: COLOR_THEMES.some((theme) => theme.key === record.colorTheme)
        ? (record.colorTheme as ColorThemeKey)
        : 'forest',
      theme: record.theme === 'light' || record.theme === 'dark' ? record.theme : 'system',
    };
  } catch {
    return null;
  }
}
