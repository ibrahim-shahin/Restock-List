import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SideMenuProvider } from '@/components/SideMenu';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorMode, useColors } from '@/hooks/useColors';
import { useReminderTaps } from '@/hooks/useReminderTaps';
import { BackupStatusProvider } from '@/state/BackupStatus';
import { ReminderProvider } from '@/state/Reminder';
import { SettingsProvider, useSettings } from '@/state/Settings';
import { StockProvider } from '@/state/StockContext';
import { showRemindersWhileOpen } from '@/utils/reminders';

// Screens opened straight from a link still get the tabs underneath them,
// so their close and back buttons have somewhere to go.
export const unstable_settings = { anchor: '(tabs)' };

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
showRemindersWhileOpen();

function RootLayoutNav() {
  const colors = useColors();
  const colorMode = useColorMode();
  useReminderTaps();

  const screenOptions = {
    headerBackTitle: 'Back',
    headerShown: false,
    contentStyle: { backgroundColor: colors.background },
  } as const;

  return (
    <StockProvider>
      <StatusBar style={colorMode === 'dark' ? 'light' : 'dark'} />
      <BackupStatusProvider>
        <ReminderProvider>
          <SideMenuProvider>
            <Stack screenOptions={screenOptions}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="item-form" options={{ presentation: 'modal' }} />
              <Stack.Screen name="stock-check" options={{ presentation: 'modal' }} />
              <Stack.Screen name="data-tools" options={{ presentation: 'modal' }} />
              <Stack.Screen name="one-time-item" options={{ presentation: 'modal' }} />
              <Stack.Screen name="reminder" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              <Stack.Screen name="check-route" options={{ presentation: 'modal' }} />
            </Stack>
          </SideMenuProvider>
        </ReminderProvider>
      </BackupStatusProvider>
    </StockProvider>
  );
}

function AppShell() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // The splash screen stays up until the saved theme is known, so the app
  // doesn't flash in the wrong colours.
  const { isReady } = useSettings();
  const ready = (fontsLoaded || Boolean(fontError)) && isReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <RootLayoutNav />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppShell />
    </SettingsProvider>
  );
}
