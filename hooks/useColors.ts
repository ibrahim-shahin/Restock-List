import { useColorScheme } from 'react-native';
import { palettes, radius } from '@/constants/colors';
import { useSettings } from '@/state/Settings';

/** 'light' or 'dark': the theme chosen in Settings, or the phone's when following it. */
export function useColorMode(): 'light' | 'dark' {
  const system = useColorScheme();
  const { settings } = useSettings();
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
  return system === 'dark' ? 'dark' : 'light';
}

/** The colours of the chosen colour theme, in light or dark. */
export function useColors() {
  const mode = useColorMode();
  const { settings } = useSettings();
  const theme = palettes[settings.colorTheme] ?? palettes.forest;
  return { ...theme[mode], radius };
}
