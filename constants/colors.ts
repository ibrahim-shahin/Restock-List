/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#1C3128',
    tint: '#244F3E',
    background: '#F6F5EF',
    foreground: '#1C3128',
    card: '#FFFFFF',
    cardForeground: '#1C3128',
    primary: '#244F3E',
    primaryForeground: '#FAF8EF',
    secondary: '#E8EDE4',
    secondaryForeground: '#2D453A',
    muted: '#EEEDE5',
    mutedForeground: '#747F72',
    accent: '#E6EDDF',
    accentForeground: '#2D453A',
    destructive: '#AF4940',
    destructiveForeground: '#FFFFFF',
    border: '#DCE1D7',
    input: '#DCE1D7',
  },
  dark: {
    text: '#F1F1E6',
    tint: '#7CB292',
    background: '#15241D',
    foreground: '#F1F1E6',
    card: '#1E3027',
    cardForeground: '#F1F1E6',
    primary: '#7CB292',
    primaryForeground: '#11231A',
    secondary: '#293A30',
    secondaryForeground: '#E7ECDF',
    muted: '#293A30',
    mutedForeground: '#ADBAAC',
    accent: '#2B3E31',
    accentForeground: '#DDEBDC',
    destructive: '#CF736A',
    destructiveForeground: '#1B1B15',
    border: '#38483D',
    input: '#38483D',
  },
  radius: 14,
};

export default colors;
