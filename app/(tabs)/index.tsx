import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StockItemCard } from '@/components/StockItemCard';
import { useColors } from '@/hooks/useColors';
import { useStock } from '@/state/StockContext';

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
          backgroundColor: selected ? colors.primary : colors.card,
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

export default function StockHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, shoppingList, isLoading, storageError } = useStock();
  const remainingCount = shoppingList.filter((item) => !item.purchased).length;
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [descending, setDescending] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState<string | null>(null);
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
            (!storeFilter || item.storeTypes.includes(storeFilter)),
        )
        .sort((a, b) => {
          const comparison =
            sortBy === 'name'
              ? a.name.localeCompare(b.name)
              : a.createdAt - b.createdAt;
          return descending ? -comparison : comparison;
        }),
    [items, locationFilter, storeFilter, sortBy, descending],
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
              <Feather name="home" size={17} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>
              HOME STOCK
            </Text>
          </View>
          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back up or restore your stock"
              onPress={() => router.push('/data-tools')}
              style={({ pressed }) => [
                styles.dataButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              testID="data-tools-button"
            >
              <Feather name="archive" size={15} color={colors.primary} />
              <Text style={[styles.addText, { color: colors.primary }]}>Backup</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add an item"
              onPress={() => router.push('/item-form')}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              testID="add-item-button"
            >
              <Feather name="plus" size={19} color={colors.primary} />
              <Text style={[styles.addText, { color: colors.primary }]}>Add item</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.headingBlock}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            YOUR HOME, IN GOOD SUPPLY
          </Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Everyday essentials,{'\n'}under control.
          </Text>
          <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
            Keep track of what you have and what to pick up.
          </Text>
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
          <View style={styles.checkTop}>
            <View style={[styles.checkIcon, { backgroundColor: colors.accent }]}>
              <Feather name="clipboard" size={19} color={colors.primary} />
            </View>
            <View style={[styles.checkArrow, { backgroundColor: colors.accent }]}>
              <Feather name="arrow-up-right" size={17} color={colors.primary} />
            </View>
          </View>
          <Text style={[styles.checkTitle, { color: colors.primaryForeground }]}>
            Check stock
          </Text>
          <Text style={[styles.checkCopy, { color: colors.primaryForeground }]}>
            Pick a store, then we’ll check only the items you buy there.
          </Text>
          <View style={styles.checkBottom}>
            <Text style={[styles.checkCount, { color: colors.primaryForeground }]}>
              {isLoading ? 'Loading your items' : `${items.length} items in your stock`}
            </Text>
            <View style={[styles.checkCta, { backgroundColor: colors.accent }]}>
              <Text style={[styles.checkCtaText, { color: colors.primary }]}>
                Start
              </Text>
              <Feather name="arrow-right" size={14} color={colors.primary} />
            </View>
          </View>
        </Pressable>

        {storageError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive }]}>
            <Feather
              name="alert-circle"
              size={16}
              color={colors.destructiveForeground}
            />
            <Text style={[styles.errorText, { color: colors.destructiveForeground }]}>
              {storageError}
            </Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {isLoading ? '—' : items.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              ITEMS TRACKED
            </Text>
          </View>
          <Pressable
            onPress={() => router.navigate('/(tabs)/shopping')}
            style={[styles.statCard, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {remainingCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              ON YOUR BUY LIST
            </Text>
          </Pressable>
        </View>

        {items.length > 0 ? (
          <View style={[styles.filterPanel, { backgroundColor: colors.card }]}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>
                SORT BY
              </Text>
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
                FILTER BY STORAGE
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
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>
                FILTER BY STORE
              </Text>
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
          </View>
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
              No items match these filters
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              Choose another storage place or store to see more items.
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
  content: { paddingHorizontal: 22, gap: 22 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: {
    height: 34,
    width: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  addButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
  },
  dataButton: { minHeight: 42, paddingHorizontal: 11, gap: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 15 },
  addText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  headingBlock: { gap: 9, marginTop: 2 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8 },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1.15,
  },
  subheading: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, maxWidth: 310 },
  checkCard: { borderRadius: 24, padding: 20, gap: 12 },
  checkPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  checkTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkIcon: {
    height: 38,
    width: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkArrow: {
    height: 31,
    width: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, marginTop: 1 },
  checkCopy: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.88,
    maxWidth: 300,
  },
  checkBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  checkCount: { fontFamily: 'Inter_500Medium', fontSize: 11, opacity: 0.88 },
  checkCta: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  checkCtaText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  errorBanner: {
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  errorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  statsRow: { flexDirection: 'row', gap: 11 },
  statCard: { flex: 1, borderRadius: 18, padding: 15, gap: 4 },
  filterPanel: { borderRadius: 18, padding: 14, gap: 13 },
  filterSection: { gap: 7 },
  filterLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1 },
  filterChips: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  filterChip: { minHeight: 31, paddingHorizontal: 10, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  filterChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 21 },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  sectionSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  itemCount: { fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 2 },
  loading: { paddingVertical: 42 },
  itemsList: { gap: 10 },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 25,
    gap: 11,
  },
  emptyIcon: {
    height: 49,
    width: 49,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, textAlign: 'center' },
  emptyCopy: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 270,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 4,
  },
  emptyButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pressed: { opacity: 0.75 },
});
