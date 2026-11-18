import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuButton } from '@/components/SideMenu';
import { StockItemCard } from '@/components/StockItemCard';
import { useColors } from '@/hooks/useColors';
import { useBackupStatus } from '@/state/BackupStatus';
import { useSettings } from '@/state/Settings';
import { useStock } from '@/state/StockContext';
import { backupReminder } from '@/utils/backup';
import { greetingFor } from '@/utils/greeting';
import { matchesSearch } from '@/utils/search';

type SortBy = 'date' | 'name';

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.primary : colors.background,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: selected ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NoticeCard({
  icon,
  title,
  copy,
  testID,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  copy: string;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens backup options"
      onPress={() => router.push('/data-tools')}
      style={({ pressed }) => [
        styles.noticeCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={[styles.noticeIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.noticeBody}>
        <Text style={[styles.noticeTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.noticeCopy, { color: colors.mutedForeground }]}>{copy}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function StockHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, shoppingList, isLoading, storageError, loadProblem, loadNotice } = useStock();
  const { lastBackupAt, checkedAt } = useBackupStatus();
  const { settings } = useSettings();
  const reminder =
    isLoading || checkedAt === null
      ? null
      : backupReminder(lastBackupAt, items.length > 0, checkedAt, settings.backupReminderDays);
  const toBuy = shoppingList.filter((item) => !item.purchased).length;
  const [greeting] = useState(() => greetingFor(new Date().getHours()));
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [descending, setDescending] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = (locationFilter ? 1 : 0) + (storeFilter ? 1 : 0);
  const locations = useMemo(
    () => [...new Set(items.map((item) => item.location))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const stores = useMemo(
    () => [...new Set(items.flatMap((item) => item.storeTypes))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const visibleItems = useMemo(
    () =>
      items
        .filter(
          (item) =>
            (!locationFilter || item.location === locationFilter) &&
            (!storeFilter || item.storeTypes.includes(storeFilter)) &&
            matchesSearch(item, query),
        )
        .sort((a, b) => {
          const comparison =
            sortBy === 'name'
              ? a.name.localeCompare(b.name)
              : a.createdAt - b.createdAt;
          return descending ? -comparison : comparison;
        }),
    [items, locationFilter, storeFilter, query, sortBy, descending],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12),
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 118 : 104),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <MenuButton />
          <Text style={[styles.brandName, { color: colors.foreground }]}>Home Stock</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add an item"
            onPress={() => router.push('/item-form')}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            testID="add-item-button"
          >
            <Feather name="plus" size={17} color={colors.primaryForeground} />
            <Text style={[styles.addText, { color: colors.primaryForeground }]}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>{greeting}</Text>
          <View style={styles.statPills}>
            <View style={[styles.statPill, { backgroundColor: colors.card }]}>
              <Feather name="package" size={13} color={colors.primary} />
              <Text style={[styles.statText, { color: colors.foreground }]} testID="items-count">
                {isLoading ? 'Loading' : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
              </Text>
            </View>
            <Pressable
              accessibilityHint="Opens your buy list"
              accessibilityRole="button"
              onPress={() => router.navigate('/(tabs)/shopping')}
              style={({ pressed }) => [
                styles.statPill,
                { backgroundColor: colors.card },
                pressed && styles.pressed,
              ]}
              testID="to-buy-count"
            >
              <Feather name="shopping-bag" size={13} color={colors.primary} />
              <Text style={[styles.statText, { color: colors.foreground }]}>
                {toBuy} to buy
              </Text>
              <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/stock-check')}
          style={({ pressed }) => [
            styles.checkCard,
            { backgroundColor: colors.primary },
            pressed && styles.checkPressed,
          ]}
          testID="check-stock-button"
        >
          <View style={[styles.checkIcon, { backgroundColor: colors.accent }]}>
            <Feather name="clipboard" size={20} color={colors.primary} />
          </View>
          <View style={styles.checkBody}>
            <Text style={[styles.checkTitle, { color: colors.primaryForeground }]}>
              Check stock
            </Text>
            <Text style={[styles.checkCopy, { color: colors.primaryForeground }]}>
              Pick a store and walk through your home, one place at a time.
            </Text>
          </View>
          <View style={[styles.checkArrow, { backgroundColor: colors.accent }]}>
            <Feather name="arrow-right" size={17} color={colors.primary} />
          </View>
        </Pressable>

        {storageError ? (
          <Pressable
            accessibilityRole={loadProblem ? 'button' : undefined}
            disabled={!loadProblem}
            onPress={() => router.push('/data-tools')}
            style={[styles.errorBanner, { backgroundColor: colors.destructive }]}
            testID="storage-error"
          >
            <Feather name="alert-circle" size={16} color={colors.destructiveForeground} />
            <Text style={[styles.errorText, { color: colors.destructiveForeground }]}>
              {storageError}
            </Text>
            {loadProblem ? (
              <Feather name="chevron-right" size={16} color={colors.destructiveForeground} />
            ) : null}
          </Pressable>
        ) : null}

        {loadNotice ? (
          <NoticeCard
            icon="info"
            title="Some saved items were left out"
            copy={loadNotice}
            testID="load-notice"
          />
        ) : null}

        {reminder ? (
          <NoticeCard
            icon="archive"
            title={reminder}
            copy="Save a backup file so you can restore your stock on a new phone."
            testID="backup-reminder"
          />
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Your essentials
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Tap an item to update its details
            </Text>
          </View>
          {visibleItems.length > 0 ? (
            <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>
              {visibleItems.length} of {items.length}
            </Text>
          ) : null}
        </View>

        {items.length > 0 ? (
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                accessibilityLabel="Search your stock"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search items, places or stores"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.foreground }]}
                value={query}
                testID="stock-search-input"
              />
              {query ? (
                <Pressable
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setQuery('')}
                  testID="clear-search-button"
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel={
                activeFilters > 0 ? `Sort and filter, ${activeFilters} active` : 'Sort and filter'
              }
              accessibilityRole="button"
              accessibilityState={{ expanded: showFilters }}
              onPress={() => setShowFilters((current) => !current)}
              style={({ pressed }) => [
                styles.filterToggle,
                {
                  backgroundColor: showFilters ? colors.primary : colors.card,
                  borderColor: showFilters ? colors.primary : colors.border,
                },
                pressed && styles.pressed,
              ]}
              testID="toggle-filters-button"
            >
              <Feather
                name="sliders"
                size={16}
                color={showFilters ? colors.primaryForeground : colors.primary}
              />
              {activeFilters > 0 ? (
                <View style={[styles.filterBadge, { backgroundColor: colors.destructive }]}>
                  <Text style={[styles.filterBadgeText, { color: colors.destructiveForeground }]}>
                    {activeFilters}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        ) : null}

        {items.length > 0 && showFilters ? (
          <View style={[styles.filterPanel, { backgroundColor: colors.card }]} testID="filter-panel">
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>SORT BY</Text>
              <View style={styles.filterChips}>
                <FilterChip
                  label="Date added"
                  selected={sortBy === 'date'}
                  onPress={() => {
                    setSortBy('date');
                    setDescending(true);
                  }}
                />
                <FilterChip
                  label="Name"
                  selected={sortBy === 'name'}
                  onPress={() => {
                    setSortBy('name');
                    setDescending(false);
                  }}
                />
                <FilterChip
                  label={
                    sortBy === 'date'
                      ? descending
                        ? 'Newest first'
                        : 'Oldest first'
                      : descending
                        ? 'Z–A'
                        : 'A–Z'
                  }
                  selected
                  onPress={() => setDescending((current) => !current)}
                />
              </View>
            </View>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>
                STORAGE PLACE
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterChips}>
                  <FilterChip
                    label="All"
                    selected={locationFilter === null}
                    onPress={() => setLocationFilter(null)}
                  />
                  {locations.map((location) => (
                    <FilterChip
                      key={location}
                      label={location}
                      selected={locationFilter === location}
                      onPress={() => setLocationFilter(location)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>STORE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterChips}>
                  <FilterChip
                    label="All"
                    selected={storeFilter === null}
                    onPress={() => setStoreFilter(null)}
                  />
                  {stores.map((store) => (
                    <FilterChip
                      key={store}
                      label={store}
                      selected={storeFilter === store}
                      onPress={() => setStoreFilter(store)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
            {activeFilters > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setLocationFilter(null);
                  setStoreFilter(null);
                }}
                style={styles.clearFilters}
                testID="clear-filters-button"
              >
                <Text style={[styles.clearFiltersText, { color: colors.primary }]}>
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
              <Feather name="archive" size={21} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Start with one essential
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              Add an item, choose where it lives, and set how much you want to keep on hand.
            </Text>
            <Pressable
              onPress={() => router.push('/item-form')}
              style={({ pressed }) => [
                styles.emptyButton,
                { backgroundColor: colors.secondary },
                pressed && styles.pressed,
              ]}
              testID="empty-add-item-button"
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={[styles.emptyButtonText, { color: colors.primary }]}>
                Add your first item
              </Text>
            </Pressable>
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
              <Feather name="filter" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {query.trim() ? 'No items match your search' : 'No items match these filters'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              {query.trim()
                ? 'Try another word, or clear the search to see everything.'
                : 'Choose another storage place or store to see more items.'}
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {visibleItems.map((item) => (
              <StockItemCard
                key={item.id}
                item={item}
                onEdit={() =>
                  router.push({
                    pathname: '/item-form',
                    params: { itemId: item.id },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandName: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 16 },
  addButton: { minHeight: 42, paddingHorizontal: 14, gap: 6, flexDirection: 'row', alignItems: 'center', borderRadius: 15 },
  addText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  greetingBlock: { gap: 11, marginTop: 4 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.8 },
  statPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statPill: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12 },
  statText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  checkCard: { borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  checkIcon: { height: 44, width: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  checkBody: { flex: 1, gap: 4 },
  checkTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  checkCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, opacity: 0.9 },
  checkArrow: { height: 34, width: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 18, borderWidth: 1 },
  noticeIcon: { height: 34, width: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  noticeBody: { flex: 1, gap: 3 },
  noticeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17 },
  noticeCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  sectionSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  itemCount: { fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -6 },
  searchBox: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 42, fontFamily: 'Inter_500Medium', fontSize: 13, paddingVertical: 8 },
  filterToggle: { height: 44, width: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  filterPanel: { borderRadius: 18, padding: 14, gap: 13, marginTop: -6 },
  filterSection: { gap: 7 },
  filterLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  filterChips: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  filterChip: { minHeight: 32, paddingHorizontal: 11, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  filterChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  clearFilters: { alignSelf: 'flex-start', paddingVertical: 4 },
  clearFiltersText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  loading: { paddingVertical: 42 },
  itemsList: { gap: 10 },
  emptyCard: { alignItems: 'center', borderRadius: 22, paddingHorizontal: 24, paddingVertical: 25, gap: 11 },
  emptyIcon: { height: 49, width: 49, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, textAlign: 'center' },
  emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 270 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 14, marginTop: 4 },
  emptyButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pressed: { opacity: 0.75 },
});
