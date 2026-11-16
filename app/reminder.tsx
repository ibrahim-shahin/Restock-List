import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useReminder } from '@/state/Reminder';
import {
  DEFAULT_REMINDER,
  REMINDER_HOURS,
  WEEKDAYS,
  describeReminder,
  formatHour,
  type ReminderSettings,
} from '@/utils/reminders';

function Chip({
  label,
  selected,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.background,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ReminderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { reminder, saveReminder } = useReminder();
  const settings = reminder ?? DEFAULT_REMINDER;
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const disabled = reminder === null || isSaving;

  // Checked on opening, and again on coming back from the phone's settings.
  useEffect(() => {
    let isMounted = true;
    function checkPermission() {
      Notifications.getPermissionsAsync()
        .then((permission) => {
          if (isMounted) setPermissionGranted(permission.granted);
        })
        .catch(() => undefined);
    }
    checkPermission();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermission();
    });
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  async function apply(next: ReminderSettings) {
    setIsSaving(true);
    setError('');
    try {
      const saved = await saveReminder(next);
      if (!saved) {
        setPermissionGranted(false);
        setError('Home Stock needs permission to send notifications. Allow it in your phone settings, then try again.');
      } else if (next.enabled) {
        setPermissionGranted(true);
      }
    } catch {
      setError('The reminder could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const notificationsBlocked = settings.enabled && permissionGranted === false;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Weekly reminder</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Feather name="bell" size={21} color={colors.primary} />
          </View>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Remind me to check stock
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {"Get a notification once a week, so you can check what you're running low on before you shop. Tapping it opens the stock check."}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Weekly reminder</Text>
              <Text style={[styles.cardCopy, { color: colors.mutedForeground }]} testID="reminder-summary">
                {describeReminder(settings)}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Weekly reminder"
              disabled={disabled}
              onValueChange={(enabled) => void apply({ ...settings, enabled })}
              thumbColor={colors.card}
              trackColor={{ false: colors.border, true: colors.primary }}
              value={settings.enabled}
              testID="reminder-switch"
            />
          </View>
        </View>

        {settings.enabled ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>DAY</Text>
            <View style={styles.chips}>
              {WEEKDAYS.map((weekday) => (
                <Chip
                  key={weekday.value}
                  label={weekday.short}
                  selected={settings.weekday === weekday.value}
                  disabled={disabled}
                  onPress={() => void apply({ ...settings, weekday: weekday.value })}
                  testID={`reminder-day-${weekday.short}`}
                />
              ))}
            </View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>TIME</Text>
            <View style={styles.chips}>
              {REMINDER_HOURS.map((hour) => (
                <Chip
                  key={hour}
                  label={formatHour(hour)}
                  selected={settings.hour === hour}
                  disabled={disabled}
                  onPress={() => void apply({ ...settings, hour })}
                  testID={`reminder-hour-${hour}`}
                />
              ))}
            </View>
          </View>
        ) : null}

        {error || notificationsBlocked ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
              {error ||
                "Notifications are turned off for Home Stock, so this reminder won't appear. Turn them on in your phone settings."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
              ]}
              testID="open-settings-button"
            >
              <Feather name="settings" size={16} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                Open phone settings
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  content: { paddingHorizontal: 22, gap: 16 },
  intro: { gap: 9, marginTop: 10, marginBottom: 2 },
  icon: { height: 48, width: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 25, lineHeight: 31, letterSpacing: -0.6 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  card: { borderRadius: 19, padding: 16, gap: 11 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  cardCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchCopy: { flex: 1, gap: 4 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 34, minWidth: 46, paddingHorizontal: 10, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  secondaryButton: { minHeight: 47, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});
