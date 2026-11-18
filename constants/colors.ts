/**
 * Colour themes. Each has a light and a dark palette; Settings picks the
 * theme and whether to follow the phone, or always use light or dark.
 *
 * Every pair of text and background colours here is checked for contrast
 * by constants/__tests__/colors.test.ts.
 */

export type Palette = {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
};

export const COLOR_THEMES = [
  { key: 'forest', name: 'Forest' },
  { key: 'ocean', name: 'Ocean' },
  { key: 'plum', name: 'Plum' },
  { key: 'clay', name: 'Clay' },
] as const;

export type ColorThemeKey = (typeof COLOR_THEMES)[number]['key'];

export const palettes: Record<ColorThemeKey, { light: Palette; dark: Palette }> = {
  forest: {
    light: {
      background: '#F6F5EF',
      foreground: '#1C3128',
      card: '#FFFFFF',
      primary: '#244F3E',
      primaryForeground: '#FAF8EF',
      secondary: '#E8EDE4',
      secondaryForeground: '#2D453A',
      muted: '#EEEDE5',
      mutedForeground: '#5C6A5B',
      accent: '#E6EDDF',
      accentForeground: '#2D453A',
      destructive: '#AF4940',
      destructiveForeground: '#FFFFFF',
      border: '#DCE1D7',
    },
    dark: {
      background: '#15241D',
      foreground: '#F1F1E6',
      card: '#1E3027',
      primary: '#7CB292',
      primaryForeground: '#11231A',
      secondary: '#293A30',
      secondaryForeground: '#E7ECDF',
      muted: '#293A30',
      mutedForeground: '#ADBAAC',
      accent: '#2B3E31',
      accentForeground: '#DDEBDC',
      destructive: '#E0847B',
      destructiveForeground: '#1B1B15',
      border: '#38483D',
    },
  },
  ocean: {
    light: {
      background: '#F3F6F9',
      foreground: '#15263A',
      card: '#FFFFFF',
      primary: '#1F4E79',
      primaryForeground: '#F7FAFD',
      secondary: '#E3EBF3',
      secondaryForeground: '#22405E',
      muted: '#EAEFF4',
      mutedForeground: '#556577',
      accent: '#E1EAF4',
      accentForeground: '#22405E',
      destructive: '#AF4940',
      destructiveForeground: '#FFFFFF',
      border: '#D7E0EA',
    },
    dark: {
      background: '#0F1B27',
      foreground: '#EEF3F8',
      card: '#182736',
      primary: '#86B7E2',
      primaryForeground: '#0D1E2E',
      secondary: '#213345',
      secondaryForeground: '#E1EBF5',
      muted: '#213345',
      mutedForeground: '#A7B6C6',
      accent: '#223649',
      accentForeground: '#DCE8F5',
      destructive: '#E0847B',
      destructiveForeground: '#1B1515',
      border: '#2F4256',
    },
  },
  plum: {
    light: {
      background: '#F8F5F8',
      foreground: '#2B1B33',
      card: '#FFFFFF',
      primary: '#5B3270',
      primaryForeground: '#FBF7FD',
      secondary: '#EEE6F1',
      secondaryForeground: '#4A2C5A',
      muted: '#F1EBF2',
      mutedForeground: '#6A5A72',
      accent: '#EDE3F1',
      accentForeground: '#4A2C5A',
      destructive: '#AF4940',
      destructiveForeground: '#FFFFFF',
      border: '#E3D9E7',
    },
    dark: {
      background: '#1C1421',
      foreground: '#F5EFF7',
      card: '#281D2F',
      primary: '#CBA2DF',
      primaryForeground: '#24152D',
      secondary: '#33253C',
      secondaryForeground: '#EFE4F4',
      muted: '#33253C',
      mutedForeground: '#BBA9C4',
      accent: '#362841',
      accentForeground: '#EBDDF2',
      destructive: '#E0847B',
      destructiveForeground: '#1B1515',
      border: '#43334D',
    },
  },
  clay: {
    light: {
      background: '#F9F5F0',
      foreground: '#33221A',
      card: '#FFFFFF',
      primary: '#8A3D21',
      primaryForeground: '#FFF8F3',
      secondary: '#F2E6DD',
      secondaryForeground: '#6B3420',
      muted: '#F2EBE4',
      mutedForeground: '#6F5D55',
      accent: '#F3E4D8',
      accentForeground: '#6B3420',
      destructive: '#A8243A',
      destructiveForeground: '#FFFFFF',
      border: '#E7DACF',
    },
    dark: {
      background: '#211712',
      foreground: '#F8EFE9',
      card: '#2D201A',
      primary: '#E6A584',
      primaryForeground: '#2A160D',
      secondary: '#3A2A22',
      secondaryForeground: '#F3E3D8',
      muted: '#3A2A22',
      mutedForeground: '#C4AFA4',
      accent: '#3D2C23',
      accentForeground: '#F1DFD2',
      destructive: '#F08A8A',
      destructiveForeground: '#1B1212',
      border: '#4A372D',
    },
  },
};

export const radius = 14;
