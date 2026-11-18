import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { type ComponentProps, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OptionChips } from '@/components/OptionChips';
import { useColors } from '@/hooks/useColors';
import { useReminder } from '@/state/Reminder';
import { BACKUP_REMINDER_OPTIONS, useSettings } from '@/state/Settings';
import { describeReminder } from '@/utils/reminders';

type IconName = ComponentProps<typeof Feather>['name'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>{children}</View>
    </View>
  );
}

function RowHeading({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  const colors = useColors();
  return (
    <>
      <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
    </>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();
  const { reminder } = useReminder();
  const version = Constants.expoConfig?.version;

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
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="REMINDERS">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/reminder')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID="settings-weekly-reminder"
          >
            <RowHeading
              icon="bell"
              title="Weekly stock check"
              subtitle={reminder ? describeReminder(reminder) : 'Loading'}
            />
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.block}>
            <View style={styles.row}>
              <RowHeading
                icon="archive"
                title="Backup reminder"
                subtitle="Remind me on the Stock screen when my last backup is older than:"
              />
            </View>
            <OptionChips
              options={BACKUP_REMINDER_OPTIONS.map((option) => ({
                value: option.days,
                label: option.label,
              }))}
              value={settings.backupReminderDays}
              onSelect={(days) => updateSettings({ backupReminderDays: days })}
              testIDPrefix="backup-reminder-days"
            />
          </View>
        </Section>

        <Section title="FEEL">
          <View style={styles.row}>
            <RowHeading
              icon="smartphone"
              title="Vibration"
              subtitle="A light buzz when you answer a stock check or tick an item."
            />
            <Switch
              accessibilityLabel="Vibration"
              onValueChange={(haptics) => updateSettings({ haptics })}
              thumbColor={colors.card}
              trackColor={{ false: colors.border, true: colors.primary }}
              value={settings.haptics}
              testID="settings-vibration"
            />
          </View>
        </Section>

        <Section title="ABOUT">
          <View style={styles.row}>
            <RowHeading
              icon="lock"
              title={`Home Stock${version ? ` ${version}` : ''}`}
              subtitle="Your stock stays on this phone. Nothing is sent anywhere, so keep a backup file somewhere safe."
            />
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  content: { paddingHorizontal: 22, paddingTop: 8, gap: 22 },
  section: { gap: 8 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, paddingHorizontal: 4 },
  card: { borderRadius: 19, paddingHorizontal: 14, paddingVertical: 4 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  block: { paddingBottom: 14 },
  rowIcon: { height: 36, width: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  rowSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.7 },
});
