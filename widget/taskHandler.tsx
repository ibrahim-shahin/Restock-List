import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { renderBuyListWidget } from './BuyListWidget';
import { loadWidgetSnapshot } from './snapshot';

/** Draws the widget when Android adds, updates or resizes it, even with the app closed. */
export async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  // Taps open links handled by Android itself, and a removed widget needs nothing.
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const snapshot = await loadWidgetSnapshot();
  renderWidget(renderBuyListWidget(snapshot, widgetInfo.height));
}
