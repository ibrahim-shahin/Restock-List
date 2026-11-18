import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useBackupStatus } from '@/state/BackupStatus';
import { useStock } from '@/state/StockContext';
import { describeLastBackup } from '@/utils/backup';

type SideMenuValue = { openMenu: () => void };

// Without a provider (in tests), opening the menu does nothing.
const SideMenuContext = createContext<SideMenuValue>({ openMenu: () => undefined });

export function useSideMenu() {
  return useContext(SideMenuContext);
}

function MenuLink({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityHint={subtitle}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        pressed && { backgroundColor: colors.secondary },
      ]}
      testID={testID}
    >
      <View style={[styles.linkIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={17} color={colors.primary} />
      </View>
      <View style={styles.linkBody}>
        <Text style={[styles.linkTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.linkSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
    </Pressable>
  );
}

export function SideMenuProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { items, shoppingList } = useStock();
  const { lastBackupAt, checkedAt } = useBackupStatus();
  const [visible, setVisible] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const panelWidth = Math.min(320, Math.round(width * 0.84));
  const toBuy = shoppingList.filter((entry) => !entry.purchased).length;
  const version = Constants.expoConfig?.version;

  const openMenu = useCallback(() => {
    setVisible(true);
    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [progress]);

  const closeMenu = useCallback(() => {
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setVisible(false),
    );
  }, [progress]);

  // The menu sits in its own window, so it closes at once before navigating.
  function go(href: Href) {
    progress.setValue(0);
    setVisible(false);
    router.push(href);
  }

  const value = useMemo(() => ({ openMenu }), [openMenu]);

  return (
    <SideMenuContext.Provider value={value}>
      {children}
      <Modal
        animationType="none"
        navigationBarTranslucent
        onRequestClose={closeMenu}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, { opacity: progress }]}>
            <Pressable
              accessibilityLabel="Close menu"
              onPress={closeMenu}
              style={StyleSheet.absoluteFill}
              testID="menu-backdrop"
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.panel,
              {
                width: panelWidth,
                backgroundColor: colors.background,
                paddingTop: insets.top + 18,
                paddingBottom: insets.bottom + 18,
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-panelWidth, 0],
                    }),
                  },
                ],
              },
            ]}
            testID="side-menu"
          >
            <View style={styles.header}>
              <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
                <Feather name="home" size={18} color={colors.primaryForeground} />
              </View>
              <View style={styles.headerBody}>
                <Text style={[styles.brandName, { color: colors.foreground }]}>Home Stock</Text>
                <Text style={[styles.summary, { color: colors.mutedForeground }]}>
                  {items.length} {items.length === 1 ? 'item' : 'items'} · {toBuy} to buy
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close menu"
                accessibilityRole="button"
                hitSlop={8}
                onPress={closeMenu}
                style={styles.closeButton}
                testID="close-menu-button"
              >
                <Feather name="x" size={19} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.links}>
              <MenuLink
                icon="clipboard"
                title="Check stock"
                subtitle="Walk through one store's items"
                onPress={() => go('/stock-check')}
                testID="menu-check-stock"
              />
              <MenuLink
                icon="archive"
                title="Backup & restore"
                subtitle={
                  checkedAt === null
                    ? 'Save or open a backup file'
                    : describeLastBackup(lastBackupAt, checkedAt)
                }
                onPress={() => go('/data-tools')}
                testID="menu-backup"
              />
              <MenuLink
                icon="settings"
                title="Settings"
                subtitle="Reminders, vibration and more"
                onPress={() => go('/settings')}
                testID="menu-settings"
              />
            </View>

            <View style={styles.footer}>
              <Feather name="lock" size={13} color={colors.mutedForeground} />
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                Your stock stays on this phone.{version ? ` Version ${version}.` : ''}
              </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SideMenuContext.Provider>
  );
}

/** The ☰ button that opens the side menu. */
export function MenuButton() {
  const colors = useColors();
  const { openMenu } = useSideMenu();
  return (
    <Pressable
      accessibilityLabel="Open menu"
      accessibilityRole="button"
      hitSlop={6}
      onPress={openMenu}
      style={({ pressed }) => [
        styles.menuButton,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      testID="open-menu-button"
    >
      <Feather name="menu" size={18} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 26,
    elevation: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, marginBottom: 26 },
  brandIcon: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerBody: { flex: 1, gap: 3 },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  summary: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  closeButton: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
  links: { gap: 4 },
  link: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderRadius: 16 },
  linkIcon: { height: 38, width: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  linkBody: { flex: 1, gap: 3 },
  linkTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  linkSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8 },
  footerText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  menuButton: { height: 42, width: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
