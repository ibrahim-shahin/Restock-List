import { COLOR_THEMES, palettes, type Palette } from '../colors';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Text and icons the app draws on each surface; 4.5 is WCAG AA for normal text.
// Unticked checkboxes and switches that are off use mutedForeground too, so
// they stay visible (controls need at least 3:1).
const PAIRS: [keyof Palette, keyof Palette, number][] = [
  ['foreground', 'background', 7],
  ['foreground', 'card', 7],
  ['mutedForeground', 'background', 4.5],
  ['mutedForeground', 'card', 4.5],
  ['primaryForeground', 'primary', 4.5],
  ['primary', 'accent', 4.5],
  ['primary', 'card', 4.5],
  ['primary', 'background', 4.5],
  ['primary', 'secondary', 4.5],
  ['secondaryForeground', 'secondary', 4.5],
  ['destructiveForeground', 'destructive', 4.5],
  ['destructive', 'card', 4.5],
  ['destructive', 'background', 4.5],
];

describe.each(COLOR_THEMES.map((theme) => theme.key))('%s colours', (key) => {
  it.each(['light', 'dark'] as const)('are readable in %s mode', (mode) => {
    const palette = palettes[key][mode];
    const failures = PAIRS.filter(([text, surface, minimum]) => contrast(palette[text], palette[surface]) < minimum)
      .map(([text, surface]) => `${text} on ${surface}: ${contrast(palette[text], palette[surface]).toFixed(2)}`);
    expect(failures).toEqual([]);
  });
});
