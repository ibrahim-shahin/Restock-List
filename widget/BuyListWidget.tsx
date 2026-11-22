// The widget library calls these components as plain functions, outside React,
// so the React Compiler (which adds hooks) must leave this file alone.
'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { palettes, type Palette } from '@/constants/colors';
import type { WidgetSnapshot } from './snapshot';

// Opened by expo-router like any link to the app.
export const SHOPPING_URI = 'home-stock:///shopping';
export const STOCK_CHECK_URI = 'home-stock:///stock-check';

type Hex = `#${string}`;
const hex = (color: string) => color as Hex;

/** How many rows of items fit in a widget of this height (in dp), counting a "+ N more" row. */
export function linesThatFit(height: number): number {
  return Math.max(1, Math.min(8, Math.floor((height - 92) / 22)));
}

/** What a screen reader says for the widget: Android draws it as a picture, so its text can't be read. */
export function describeWidget(snapshot: WidgetSnapshot | null): string {
  if (!snapshot) return 'Buy list. Open Home Stock to show your buy list here.';
  if (snapshot.toBuy === 0) return 'Buy list, all done.';
  const names = snapshot.lines.map((line) => line.name);
  const more = snapshot.toBuy - names.length;
  const estimate = snapshot.estimate ? ` ${snapshot.estimate}.` : '';
  return `Buy list, ${snapshot.toBuy} to buy: ${names.join(', ')}${more > 0 ? `, and ${more} more` : ''}.${estimate}`;
}

function BuyListLayout({
  snapshot,
  colors,
  maxLines,
}: {
  // null until the app has saved what is on the buy list.
  snapshot: WidgetSnapshot | null;
  colors: Palette;
  maxLines: number;
}) {
  const toBuy = snapshot?.toBuy ?? 0;
  // When not everything fits, the last row says how many more there are.
  // A one-row widget has no room for that; its header has the count.
  const fitsAll = toBuy <= maxLines;
  const shown = (snapshot?.lines ?? []).slice(0, fitsAll || maxLines === 1 ? maxLines : maxLines - 1);
  const more = maxLines > 1 ? toBuy - shown.length : 0;
  const muted = hex(colors.mutedForeground);

  return (
    <FlexWidget
      accessibilityLabel={describeWidget(snapshot)}
      clickAction="OPEN_URI"
      clickActionData={{ uri: SHOPPING_URI }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: hex(colors.card),
        borderRadius: 22,
        padding: 14,
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget text="🛍️ Buy list" style={{ fontSize: 15, fontWeight: '700', color: hex(colors.foreground) }} />
        <FlexWidget style={{ flex: 1 }} />
        {snapshot ? (
          <TextWidget
            text={toBuy === 0 ? 'All done' : `${toBuy} to buy`}
            style={{ fontSize: 12, fontWeight: '600', color: muted }}
          />
        ) : null}
      </FlexWidget>

      {/* Takes the space between the header and the buttons, and no more, so the buttons stay in view. */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 0,
          flex: 1,
          flexDirection: 'column',
          flexGap: 4,
          marginTop: 8,
          overflow: 'hidden',
        }}
      >
        {!snapshot ? (
          <TextWidget
            text="Open Home Stock to show your buy list here."
            maxLines={2}
            style={{ fontSize: 13, color: muted }}
          />
        ) : shown.length === 0 ? (
          <TextWidget
            text="Nothing to buy. Check your stock when you're ready."
            maxLines={2}
            style={{ fontSize: 13, color: muted }}
          />
        ) : (
          shown.map((line, index) => (
            <FlexWidget
              key={`${index}-${line.name}`}
              style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}
            >
              {/* The name gets what the amount leaves, and is cut short to fit. */}
              <FlexWidget style={{ width: 0, flex: 1 }}>
                <TextWidget
                  text={`${line.emoji}  ${line.name}`}
                  maxLines={1}
                  truncate="END"
                  style={{ fontSize: 13, fontWeight: '600', color: hex(colors.foreground) }}
                />
              </FlexWidget>
              {line.amount ? (
                <TextWidget text={line.amount} maxLines={1} style={{ fontSize: 12, marginLeft: 8, color: muted }} />
              ) : null}
            </FlexWidget>
          ))
        )}
        {more > 0 ? <TextWidget text={`+ ${more} more`} style={{ fontSize: 12, color: muted }} /> : null}
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <TextWidget
          text={snapshot?.estimate ?? ''}
          maxLines={1}
          style={{ fontSize: 12, fontWeight: '600', color: muted }}
        />
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget
          accessibilityLabel="Check stock"
          clickAction="OPEN_URI"
          clickActionData={{ uri: STOCK_CHECK_URI }}
          style={{
            backgroundColor: hex(colors.primary),
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          <TextWidget text="Check stock" style={{ fontSize: 12, fontWeight: '700', color: hex(colors.primaryForeground) }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * The widget in light and dark, in the app's colour theme. Android picks the
 * one that matches the phone, unless the app is set to always light or dark.
 */
export function renderBuyListWidget(snapshot: WidgetSnapshot | null, height: number) {
  const theme = palettes[snapshot?.colorTheme ?? 'forest'] ?? palettes.forest;
  const maxLines = linesThatFit(height);
  const light = theme[snapshot?.theme === 'dark' ? 'dark' : 'light'];
  const dark = theme[snapshot?.theme === 'light' ? 'light' : 'dark'];
  return {
    light: <BuyListLayout snapshot={snapshot} colors={light} maxLines={maxLines} />,
    dark: <BuyListLayout snapshot={snapshot} colors={dark} maxLines={maxLines} />,
  };
}
