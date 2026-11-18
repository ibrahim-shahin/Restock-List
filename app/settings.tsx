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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OptionChips } from '@/components/OptionChips';
import { COLOR_THEMES, palettes } from '@/constants/colors';
import { useColorMode, useColors } from '@/hooks/useColors';
import { useReminder } from '@/state/Reminder';
import { useStock } from '@/state/StockContext';
import {
  BACKUP_REMINDER_OPTIONS,
  PRICE_DECIMAL_OPTIONS,
  THEME_OPTIONS,
  useSettings,
} from '@/state/Settings';
import { describeReminder } from '@/utils/reminders';
import { orderPlaces } from '@/utils/stockCheck';

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
  const colorMode = useColorMode();
  const { items } = useStock();
  const route = orderPlaces(
    items.map((item) => item.location),
    settings.placeOrder,
  );
  const routeSummary =
    route.length === 0
      ? 'Add items with storage places first'
      : settings.placeOrder.length === 0
        ? 'A to Z by storage place. Tap to set your own order.'
        : `${route.slice(0, 3).join(' → ')}${route.length > 3 ? ' → …' : ''}`;
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
        <Section title="APPEARANCE">
          <View style={styles.block}>
            <View style={styles.row}>
              <RowHeading icon="sun" title="Theme" subtitle="Light, dark, or the same as your phone." />
            </View>
            <OptionChips
              options={THEME_OPTIONS}
              value={settings.theme}
              onSelect={(theme) => updateSettings({ theme })}
              testIDPrefix="theme"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.block}>
            <View style={styles.row}>
              <RowHeading icon="droplet" title="Colour" />
            </View>
            <View style={styles.swatches}>
              {COLOR_THEMES.map((theme) => {
                const selected = settings.colorTheme === theme.key;
                const swatch = palettes[theme.key][colorMode];
                return (
                  <Pressable
                    key={theme.key}
                    accessibilityLabel={`${theme.name} colours`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => updateSettings({ colorTheme: theme.key })}
                    style={styles.swatchOption}
                    testID={`color-theme-${theme.key}`}
                  >
                    <View
                      style={[
                        styles.swatchRing,
                        { borderColor: selected ? colors.foreground : 'transparent' },
                      ]}
                    >
                      <View style={[styles.swatch, { backgroundColor: swatch.primary }]}>
                        <View style={[styles.swatchDot, { backgroundColor: swatch.accent }]} />
                        {selected ? (
                          <Feather name="check" size={15} color={swatch.primaryForeground} />
                        ) : null}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.swatchName,
                        { color: selected ? colors.foreground : colors.mutedForeground },
                      ]}
                    >
                      {theme.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

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

        <Section title="STOCK CHECK">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/check-route')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID="settings-check-route"
          >
            <RowHeading icon="map" title="Route through your home" subtitle={routeSummary} />
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        </Section>

        <Section title="SHOPPING">
          <View style={styles.row}>
            <RowHeading
              icon="sun"
              title="Keep the screen on"
              subtitle="While the buy list is open, so your phone doesn't lock while you shop."
            />
            <Switch
              accessibilityLabel="Keep the screen on"
              onValueChange={(keepScreenOn) => updateSettings({ keepScreenOn })}
              thumbColor={colors.card}
              trackColor={{ false: colors.mutedForeground, true: colors.primary }}
              value={settings.keepScreenOn}
              testID="settings-keep-screen-on"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <RowHeading
              icon="tag"
              title="Prices"
              subtitle="Add what things cost and see an estimated total for each trip."
            />
            <Switch
              accessibilityLabel="Prices"
              onValueChange={(showPrices) => updateSettings({ showPrices })}
              thumbColor={colors.card}
              trackColor={{ false: colors.mutedForeground, true: colors.primary }}
              value={settings.showPrices}
              testID="settings-show-prices"
            />
          </View>
          {settings.showPrices ? (
            <View style={[styles.block, styles.priceOptions]}>
              <TextInput
                accessibilityLabel="Currency"
                autoCapitalize="characters"
                maxLength={6}
                onChangeText={(currency) => updateSettings({ currency })}
                placeholder="Currency, e.g. JD"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.currencyInput,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                testID="settings-currency"
                value={settings.currency}
              />
              <OptionChips
                options={PRICE_DECIMAL_OPTIONS}
                value={settings.priceDecimals}
                onSelect={(priceDecimals) => updateSettings({ priceDecimals })}
                testIDPrefix="price-decimals"
              />
            </View>
          ) : null}
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
              trackColor={{ false: colors.mutedForeground, true: colors.primary }}
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
  priceOptions: { gap: 10 },
  rowIcon: { height: 36, width: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  rowSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth },
  currencyInput: { minHeight: 44, marginLeft: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: 'Inter_500Medium', fontSize: 13 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingLeft: 48 },
  swatchOption: { alignItems: 'center', gap: 6 },
  swatchRing: { padding: 3, borderRadius: 24, borderWidth: 2 },
  swatch: { height: 36, width: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  swatchDot: { position: 'absolute', right: -6, bottom: -6, height: 20, width: 20, borderRadius: 10 },
  swatchName: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  pressed: { opacity: 0.7 },
});
