import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { useSettings } from '@/state/Settings';
import { useStock } from '@/state/StockContext';
import { renderBuyListWidget } from './BuyListWidget';
import { buildWidgetSnapshot, saveWidgetSnapshot, WIDGET_NAME } from './snapshot';

/** Keeps the home-screen widget in step with the buy list. Renders nothing. */
export function WidgetSync() {
  const { shoppingList, isLoading, loadProblem } = useStock();
  const { settings } = useSettings();
  // What the widget was last drawn with, so changes it doesn't show don't redraw it.
  const drawnRef = useRef('');

  useEffect(() => {
    // Leave the last good widget in place while stock is loading or unreadable.
    if (Platform.OS !== 'android' || isLoading || loadProblem) return;
    const snapshot = buildWidgetSnapshot(shoppingList, settings);
    const drawn = JSON.stringify(snapshot);
    if (drawn === drawnRef.current) return;
    drawnRef.current = drawn;
    // Right away, not after a delay: timers stop while the app is in the
    // background, so a delayed update could wait until the app is opened again.
    saveWidgetSnapshot(snapshot).catch(() => undefined);
    requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: (info) => renderBuyListWidget(snapshot, info.height),
    }).catch(() => undefined);
  }, [isLoading, loadProblem, shoppingList, settings]);

  return null;
}
