import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { palettes } from '@/constants/colors';
import { DEFAULT_SETTINGS, type Settings } from '@/state/Settings';
import type { BuyListItem } from '@/state/StockContext';
import { describeWidget, linesThatFit, renderBuyListWidget, SHOPPING_URI, STOCK_CHECK_URI } from '../BuyListWidget';
import { buildWidgetSnapshot, loadWidgetSnapshot, saveWidgetSnapshot } from '../snapshot';
import { widgetTaskHandler } from '../taskHandler';
import { WidgetSync } from '../WidgetSync';

jest.mock('react-native-android-widget', () => ({
  ...jest.requireActual('react-native-android-widget'),
  requestWidgetUpdate: jest.fn(() => Promise.resolve()),
}));
const mockStock = { current: { shoppingList: [] as BuyListItem[], isLoading: false, loadProblem: null as string | null } };
jest.mock('@/state/StockContext', () => ({ useStock: () => mockStock.current }));
const mockSettings: { current: Settings } = { current: DEFAULT_SETTINGS };
jest.mock('@/state/Settings', () => ({
  ...jest.requireActual('@/state/Settings'),
  useSettings: () => ({ settings: mockSettings.current }),
}));

// The library's own builder turns widget JSX into what Android draws, and
// fails as the phone would on a component it can't use.
type WidgetNode = { type: string; props: Record<string, unknown>; children?: WidgetNode[] };
const { buildWidgetTree } = jest.requireActual<{ buildWidgetTree: (jsx: ReactElement) => WidgetNode }>(
  'react-native-android-widget/lib/commonjs/api/build-widget-tree',
);

const flatten = (node: WidgetNode): WidgetNode[] => [node, ...(node.children ?? []).flatMap(flatten)];
const widgets = (jsx: ReactElement) => flatten(buildWidgetTree(jsx));
const texts = (jsx: ReactElement) =>
  widgets(jsx).filter((w) => w.type === 'TextWidget').map((w) => String(w.props.text));

function entry(name: string, extra: Partial<BuyListItem> = {}): BuyListItem {
  return {
    id: name.toLowerCase(), name, minimumQuantity: 1, restockQuantity: 2, unit: 'L', location: 'Fridge',
    storeTypes: ['Supermarket'], createdAt: 1, entryId: `["${name}","Supermarket"]`, shoppingStoreType: 'Supermarket',
    purchased: false, ...extra,
  };
}

const allDone = buildWidgetSnapshot([], DEFAULT_SETTINGS);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockStock.current = { shoppingList: [], isLoading: false, loadProblem: null };
  mockSettings.current = DEFAULT_SETTINGS;
});

describe('what the widget shows', () => {
  it('lists what is still to buy, with emoji and amounts', () => {
    const snapshot = buildWidgetSnapshot(
      [entry('Milk'), entry('Eggs', { purchased: true }), entry('Rice', { unit: '', restockQuantity: 1 })],
      DEFAULT_SETTINGS,
    );

    expect(snapshot).toEqual({
      lines: [
        { emoji: '🥛', name: 'Milk', amount: '2 L' },
        { emoji: '🍚', name: 'Rice', amount: '1' },
      ],
      toBuy: 2,
      colorTheme: 'forest',
      theme: 'system',
    });
    expect(texts(renderBuyListWidget(snapshot, 200).light)).toEqual(
      expect.arrayContaining(['🛍️ Buy list', '2 to buy', '🥛  Milk', '2 L', '🍚  Rice', 'Check stock']),
    );
  });

  it('adds the estimate when prices are on, with the decimals you chose', () => {
    const milk = [entry('Milk', { price: 1.25 })];
    const prices = { ...DEFAULT_SETTINGS, showPrices: true, currency: 'JD' };

    expect(buildWidgetSnapshot(milk, prices).estimate).toBe('About 2.50 JD');
    expect(buildWidgetSnapshot(milk, { ...prices, priceDecimals: 3 }).estimate).toBe('About 2.500 JD');
    expect(buildWidgetSnapshot(milk, DEFAULT_SETTINGS)).not.toHaveProperty('estimate');
  });

  it('fits as many lines as its size allows, with the last row for how many more', () => {
    const many = buildWidgetSnapshot(
      ['Milk', 'Eggs', 'Rice', 'Tea', 'Soap', 'Bread'].map((name) => entry(name)),
      DEFAULT_SETTINGS,
    );
    const itemLines = (shown: string[]) => shown.filter((text) => /Milk|Eggs|Rice|Tea|Soap|Bread/.test(text));
    expect(linesThatFit(110)).toBe(1);
    expect(linesThatFit(200)).toBe(4);

    const tall = texts(renderBuyListWidget(many, 200).light);
    expect(itemLines(tall)).toHaveLength(3);
    expect(tall).toContain('+ 3 more');

    // One row: just the first item; the header has the count.
    const short = texts(renderBuyListWidget(many, 110).light);
    expect(itemLines(short)).toEqual(['🥛  Milk']);
    expect(short).toEqual(expect.arrayContaining(['6 to buy']));
    expect(short.some((text) => text.includes('more'))).toBe(false);
  });

  it('keeps the buttons in view, and long names from pushing out the amount', () => {
    const root = buildWidgetTree(renderBuyListWidget(buildWidgetSnapshot([entry('Milk')], DEFAULT_SETTINGS), 200).light);
    const all = flatten(root);
    const parentOf = (child: WidgetNode) => all.find((node) => node.children?.includes(child));
    const name = all.find((node) => node.props.text === '🥛  Milk');
    const nameBox = name && parentOf(name);
    const list = nameBox && parentOf(parentOf(nameBox)!);

    expect(nameBox?.props).toMatchObject({ width: 0, weight: 1 });
    expect(list?.props).toMatchObject({ height: 0, weight: 1 });
  });

  it('says when there is nothing to buy', () => {
    expect(texts(renderBuyListWidget(allDone, 200).light)).toEqual(
      expect.arrayContaining(['All done', "Nothing to buy. Check your stock when you're ready."]),
    );
  });

  it('asks you to open the app when it has nothing to show yet', () => {
    const shown = texts(renderBuyListWidget(null, 200).light);

    expect(shown).toContain('Open Home Stock to show your buy list here.');
    expect(shown).not.toContain('All done');
  });

  it('opens the buy list, or a stock check from its button', () => {
    const links = widgets(renderBuyListWidget(allDone, 200).light)
      .filter((w) => w.props.clickAction === 'OPEN_URI')
      .map((w) => w.props.clickActionData);

    expect(links).toEqual([{ uri: SHOPPING_URI }, { uri: STOCK_CHECK_URI }]);
  });

  it('tells screen readers what it shows, since Android draws it as a picture', () => {
    const snapshot = buildWidgetSnapshot([entry('Milk', { price: 1.25 }), entry('Rice')], {
      ...DEFAULT_SETTINGS,
      showPrices: true,
      currency: 'JD',
    });
    const labels = widgets(renderBuyListWidget(snapshot, 200).light)
      .map((w) => w.props.accessibilityLabel)
      .filter(Boolean);

    expect(labels).toEqual(['Buy list, 2 to buy: Milk, Rice. About 2.50 JD.', 'Check stock']);
    expect(describeWidget(buildWidgetSnapshot(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((n) => entry(n)), DEFAULT_SETTINGS))).toBe(
      'Buy list, 9 to buy: A, B, C, D, E, F, G, H, and 1 more.',
    );
    expect(describeWidget(allDone)).toBe('Buy list, all done.');
    expect(describeWidget(null)).toBe('Buy list. Open Home Stock to show your buy list here.');
  });

  it('comes in light and dark, or always one of them when the app is set that way', () => {
    const background = (jsx: ReactElement) => buildWidgetTree(jsx).props.backgroundColor;
    const ocean = { ...allDone, colorTheme: 'ocean' as const };

    const both = renderBuyListWidget(ocean, 200);
    expect(background(both.light)).toBe(palettes.ocean.light.card);
    expect(background(both.dark)).toBe(palettes.ocean.dark.card);

    const alwaysDark = renderBuyListWidget({ ...ocean, theme: 'dark' }, 200);
    expect(background(alwaysDark.light)).toBe(palettes.ocean.dark.card);
  });
});

describe('saving the summary for the widget', () => {
  it('reads back what was saved', async () => {
    const snapshot = buildWidgetSnapshot([entry('Milk')], DEFAULT_SETTINGS);
    await saveWidgetSnapshot(snapshot);

    await expect(loadWidgetSnapshot()).resolves.toEqual(snapshot);
  });

  it('has nothing to show when nothing valid is saved', async () => {
    await expect(loadWidgetSnapshot()).resolves.toBeNull();
    await AsyncStorage.setItem('home-stock:widget:v1', 'not json');
    await expect(loadWidgetSnapshot()).resolves.toBeNull();
  });
});

describe('the widget handler Android runs', () => {
  const info = { widgetName: 'BuyList', widgetId: 1, height: 200, width: 250, screenInfo: {} } as never;

  it('draws the widget from the saved summary when it is added or updated', async () => {
    await saveWidgetSnapshot(buildWidgetSnapshot([entry('Milk')], DEFAULT_SETTINGS));
    const renderWidget = jest.fn();

    await widgetTaskHandler({ widgetAction: 'WIDGET_ADDED', widgetInfo: info, renderWidget });

    expect(texts(renderWidget.mock.calls[0][0].light)).toContain('🥛  Milk');
  });

  it('asks you to open the app when the app has not saved anything yet', async () => {
    const renderWidget = jest.fn();

    await widgetTaskHandler({ widgetAction: 'WIDGET_ADDED', widgetInfo: info, renderWidget });

    expect(texts(renderWidget.mock.calls[0][0].light)).toContain('Open Home Stock to show your buy list here.');
  });

  it('does nothing when the widget is removed', async () => {
    const renderWidget = jest.fn();

    await widgetTaskHandler({ widgetAction: 'WIDGET_DELETED', widgetInfo: info, renderWidget });

    expect(renderWidget).not.toHaveBeenCalled();
  });
});

describe('keeping the widget up to date', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The text of the widget the last update asked Android to draw.
  async function lastDrawn() {
    const { renderWidget } = jest.mocked(requestWidgetUpdate).mock.calls.at(-1)![0];
    const drawn = (await renderWidget({ height: 200 } as never)) as { light: ReactElement };
    return texts(drawn.light);
  }

  it('updates the widget as soon as the buy list changes', async () => {
    mockStock.current = { ...mockStock.current, shoppingList: [entry('Milk')] };
    const hook = await renderHook(() => WidgetSync());

    expect(requestWidgetUpdate).toHaveBeenCalledTimes(1);
    expect(requestWidgetUpdate).toHaveBeenCalledWith(expect.objectContaining({ widgetName: 'BuyList' }));
    expect(await lastDrawn()).toContain('🥛  Milk');

    mockStock.current = { ...mockStock.current, shoppingList: [entry('Milk'), entry('Rice', { unit: '' })] };
    await hook.rerender({});

    expect(requestWidgetUpdate).toHaveBeenCalledTimes(2);
    expect(await lastDrawn()).toEqual(expect.arrayContaining(['2 to buy', '🍚  Rice']));
    await waitFor(async () => expect(await loadWidgetSnapshot()).toMatchObject({ toBuy: 2 }));
  });

  it("doesn't redraw it for changes it doesn't show", async () => {
    mockStock.current = { ...mockStock.current, shoppingList: [entry('Milk')] };
    const hook = await renderHook(() => WidgetSync());

    mockStock.current = { ...mockStock.current, shoppingList: [entry('Milk')] };
    mockSettings.current = { ...DEFAULT_SETTINGS, haptics: false };
    await hook.rerender({});

    expect(requestWidgetUpdate).toHaveBeenCalledTimes(1);
  });

  it('leaves the widget alone while stock is loading or could not be read', async () => {
    mockStock.current = { ...mockStock.current, shoppingList: [entry('Milk')], isLoading: true };
    const hook = await renderHook(() => WidgetSync());

    mockStock.current = { ...mockStock.current, isLoading: false, loadProblem: 'unreadable' };
    await hook.rerender({});

    expect(requestWidgetUpdate).not.toHaveBeenCalled();
  });
});
