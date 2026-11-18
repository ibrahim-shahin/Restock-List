import { renderHook } from '@testing-library/react-native';
import { palettes } from '@/constants/colors';
import type { Settings } from '@/state/Settings';
import { useColorMode, useColors } from '../useColors';

const mockSettings = { current: {} as Partial<Settings> };
const mockPhoneScheme = { current: 'light' as 'light' | 'dark' | 'unspecified' };

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockPhoneScheme.current,
}));

jest.mock('@/state/Settings', () => ({
  useSettings: () => ({
    settings: { backupReminderDays: 14, haptics: true, theme: 'system', colorTheme: 'forest', ...mockSettings.current },
  }),
}));

beforeEach(() => {
  mockSettings.current = {};
  mockPhoneScheme.current = 'light';
});

it('uses dark or light when chosen, whatever the phone uses', async () => {
  mockSettings.current = { theme: 'dark' };
  const dark = await renderHook(() => [useColorMode(), useColors()] as const);
  expect(dark.result.current[0]).toBe('dark');
  expect(dark.result.current[1].background).toBe(palettes.forest.dark.background);

  mockSettings.current = { theme: 'light' };
  const light = await renderHook(() => useColors());
  expect(light.result.current.background).toBe(palettes.forest.light.background);
});

it("follows the phone's setting by default", async () => {
  mockPhoneScheme.current = 'dark';
  const dark = await renderHook(() => useColorMode());
  expect(dark.result.current).toBe('dark');

  mockPhoneScheme.current = 'unspecified';
  const unknown = await renderHook(() => useColorMode());
  expect(unknown.result.current).toBe('light');
});

it('ignores the phone once light or dark is chosen', async () => {
  mockPhoneScheme.current = 'dark';
  mockSettings.current = { theme: 'light' };

  const { result } = await renderHook(() => useColorMode());

  expect(result.current).toBe('light');
});

it('applies the chosen colour theme', async () => {
  mockSettings.current = { theme: 'light', colorTheme: 'ocean' };

  const { result } = await renderHook(() => useColors());

  expect(result.current).toEqual({ ...palettes.ocean.light, radius: 14 });
});
