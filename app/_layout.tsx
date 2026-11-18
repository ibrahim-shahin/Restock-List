import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColors } from '@/hooks/useColors';
import { useReminderTaps } from '@/hooks/useReminderTaps';
import { BackupStatusProvider } from '@/state/BackupStatus';
import { ReminderProvider } from '@/state/Reminder';
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
  useReminderTaps();

  const screenOptions = {
    headerBackTitle: 'Back',
    headerShown: false,
    contentStyle: { backgroundColor: colors.background },
  } as const;

  return (
    <StockProvider>
      <BackupStatusProvider>
        <ReminderProvider>
          <Stack screenOptions={screenOptions}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="item-form" options={{ presentation: 'modal' }} />
            <Stack.Screen name="stock-check" options={{ presentation: 'modal' }} />
            <Stack.Screen name="data-tools" options={{ presentation: 'modal' }} />
            <Stack.Screen name="one-time-item" options={{ presentation: 'modal' }} />
            <Stack.Screen name="reminder" options={{ presentation: 'modal' }} />
          </Stack>
        </ReminderProvider>
      </BackupStatusProvider>
    </StockProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
