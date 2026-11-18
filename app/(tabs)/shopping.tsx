import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuButton } from '@/components/SideMenu';
import { useColors } from '@/hooks/useColors';
import { useStock } from '@/state/StockContext';
import type { BuyListItem } from '@/state/StockContext';

function quantityLabel(item: BuyListItem): string {
  return `${item.restockQuantity} ${item.unit || (item.restockQuantity === 1 ? 'unit' : 'units')}`;
}

function BuyRow({
  item,
  onToggle,
  onRemove,
}: {
  item: BuyListItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();

  return (
    <View style={[styles.buyRow, { borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.purchased }}
        accessibilityLabel={`${item.purchased ? 'Mark not purchased' : 'Mark purchased'}: ${item.name}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.buyToggle, pressed && styles.pressed]}
        testID={`buy-item-${item.id}`}
      >
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: item.purchased ? colors.primary : 'transparent',
              borderColor: item.purchased ? colors.primary : colors.mutedForeground,
            },
          ]}
        >
          {item.purchased ? (
            <Feather name="check" size={13} color={colors.primaryForeground} />
          ) : null}
        </View>
        <View style={styles.buyDetails}>
          <Text
            style={[
              styles.buyName,
              { color: item.purchased ? colors.mutedForeground : colors.foreground },
              item.purchased && styles.strikethrough,
            ]}
          >
            {item.name}
          </Text>
          {item.oneTime ? (
            <View style={styles.oneTimeLine}>
              <Feather name="zap" size={10} color={colors.primary} />
              <Text style={[styles.oneTimeText, { color: colors.primary }]}>Just this once</Text>
            </View>
          ) : (
            <Text style={[styles.buyLocation, { color: colors.mutedForeground }]}>
              {item.location}
            </Text>
          )}
        </View>
        <View style={[styles.quantityPill, { backgroundColor: colors.accent }]}>
          <Text style={[styles.quantityText, { color: colors.primary }]}>
            {quantityLabel(item)}
          </Text>
        </View>
      </Pressable>
      {item.oneTime ? (
        <Pressable
          accessibilityLabel={`Remove ${item.name} from the buy list`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRemove}
          style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
          testID={`remove-buy-item-${item.id}`}
        >
          <Feather name="x" size={15} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ShoppingListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { shoppingList, items, togglePurchased, clearPurchased, removeFromBuyList } = useStock();
  const activeItems = shoppingList.filter((item) => !item.purchased);
  const purchasedItems = shoppingList.filter((item) => item.purchased);
  const storeGroups = [...new Set(shoppingList.map((item) => item.shoppingStoreType))];

  function shareBuyList() {
    const message = [
      'Home Stock buy list',
      '',
      ...storeGroups.flatMap((store) => [
        store,
        ...shoppingList
          .filter((item) => item.shoppingStoreType === store)
          .map(
            (item) =>
              `${item.purchased ? '✓' : '•'} ${item.name} — ${quantityLabel(item)}${item.oneTime ? '' : ` (${item.location})`}`,
          ),
        '',
      ]),
    ].join('\n').trim();

    void Share.share({ message, title: 'Home Stock buy list' }).catch(() => {
      Alert.alert('Could not share', 'Please try sharing your buy list again.');
    });
  }

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
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <MenuButton />
            <View style={[styles.titleIcon, { backgroundColor: colors.accent }]}>
              <Feather name="shopping-bag" size={18} color={colors.primary} />
            </View>
          </View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>READY WHEN YOU ARE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Buy list</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {shoppingList.length === 0
              ? 'Run a stock check and your next trip will be sorted.'
              : activeItems.length === 0
                ? 'Everything has been picked up. Nice work.'
                : `${activeItems.length} ${activeItems.length === 1 ? 'thing' : 'things'} to pick up, sorted by store.`}
          </Text>
        </View>

        {shoppingList.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
              <Feather name="check-square" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Your list is clear
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              Check what you have at home and anything below its minimum will show up here.
            </Text>
            <Pressable
              onPress={() => router.push('/stock-check')}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
              testID="empty-check-stock-button"
            >
              <Feather name="clipboard" size={16} color={colors.primaryForeground} />
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                Check stock
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/one-time-item')}
              style={styles.addLink}
              testID="empty-add-one-time-item"
            >
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[styles.addLinkText, { color: colors.primary }]}>
                Add a one-time item
              </Text>
            </Pressable>
            {items.length === 0 ? (
              <Pressable
                onPress={() => router.push('/item-form')}
                style={styles.addLink}
                testID="empty-buy-list-add-item"
              >
                <Text style={[styles.addLinkText, { color: colors.primary }]}>
                  Add your first item
                </Text>
                <Feather name="arrow-right" size={14} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
              <View style={styles.progressCopy}>
                <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                  SHOPPING PROGRESS
                </Text>
                <Text style={[styles.progressTitle, { color: colors.foreground }]}>
                  {purchasedItems.length} of {shoppingList.length} picked up
                </Text>
              </View>
              <View
                style={[
                  styles.progressIcon,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Feather
                  name={activeItems.length === 0 ? 'check' : 'shopping-cart'}
                  size={17}
                  color={colors.primary}
                />
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${(purchasedItems.length / shoppingList.length) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/one-time-item')}
                style={({ pressed }) => [
                  styles.shareButton,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressed,
                ]}
                testID="add-one-time-item-button"
              >
                <Feather name="plus" size={15} color={colors.primaryForeground} />
                <Text style={[styles.shareText, { color: colors.primaryForeground }]}>
                  One-time item
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={shareBuyList}
                style={({ pressed }) => [
                  styles.shareButton,
                  { backgroundColor: colors.secondary },
                  pressed && styles.pressed,
                ]}
                testID="share-buy-list-button"
              >
                <Feather name="share-2" size={15} color={colors.primary} />
                <Text style={[styles.shareText, { color: colors.primary }]}>
                  Share
                </Text>
              </Pressable>
            </View>

            {storeGroups.map((storeType) => {
              const group = shoppingList.filter((item) => item.shoppingStoreType === storeType);
              return (
                <View key={storeType} style={styles.storeGroup}>
                  <View style={styles.storeHeading}>
                    <View style={[styles.storeIcon, { backgroundColor: colors.accent }]}>
                      <Feather name="map-pin" size={14} color={colors.primary} />
                    </View>
                    <Text style={[styles.storeTitle, { color: colors.foreground }]}>
                      {storeType}
                    </Text>
                    <Text style={[styles.storeCount, { color: colors.mutedForeground }]}>
                      {group.length}
                    </Text>
                  </View>
                  <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
                    {group.map((item) => (
                      <BuyRow
                        key={item.entryId}
                        item={item}
                        onToggle={() => togglePurchased(item.entryId)}
                        onRemove={() => removeFromBuyList(item.entryId)}
                      />
                    ))}
                    <Pressable
                      accessibilityLabel={`Add a one-time item for ${storeType}`}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({ pathname: '/one-time-item', params: { store: storeType } })
                      }
                      style={({ pressed }) => [styles.addHereRow, pressed && styles.pressed]}
                      testID={`add-one-time-item-${storeType}`}
                    >
                      <Feather name="plus" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.addHereText, { color: colors.mutedForeground }]}>
                        Add something for this trip
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            {purchasedItems.length > 0 ? (
              <Pressable
                onPress={clearPurchased}
                style={({ pressed }) => [
                  styles.clearButton,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
                testID="clear-purchased-button"
              >
                <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                <Text style={[styles.clearText, { color: colors.mutedForeground }]}>
                  Clear picked-up items
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push('/stock-check')}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: colors.secondary },
                pressed && styles.pressed,
              ]}
              testID="repeat-stock-check-button"
            >
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                Check stock again
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 20 },
  header: { gap: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  titleIcon: { height: 41, width: 41, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 31, letterSpacing: -0.9 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, maxWidth: 320 },
  emptyCard: { alignItems: 'center', borderRadius: 22, padding: 24, gap: 12, marginTop: 3 },
  emptyIcon: { height: 51, width: 51, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 19, textAlign: 'center', maxWidth: 280 },
  primaryButton: { minHeight: 47, borderRadius: 15, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 4 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1, padding: 5 },
  addLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  progressCard: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressCopy: { flex: 1, gap: 5 },
  progressLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  progressTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  progressIcon: { height: 36, width: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { position: 'absolute', left: 16, right: 16, bottom: 0, height: 3, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 3 },
  actionRow: { flexDirection: 'row', gap: 10 },
  shareButton: { flex: 1, minHeight: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  oneTimeLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  oneTimeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  removeButton: { height: 36, width: 28, alignItems: 'center', justifyContent: 'center' },
  addHereRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addHereText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  shareText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  storeGroup: { gap: 9 },
  storeHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  storeIcon: { height: 26, width: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  storeTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, flex: 1 },
  storeCount: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  groupCard: { borderRadius: 18, overflow: 'hidden', paddingHorizontal: 13 },
  buyRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  buyToggle: { flex: 1, minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkbox: { height: 22, width: 22, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  buyDetails: { flex: 1, gap: 4 },
  buyName: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  buyLocation: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  strikethrough: { textDecorationLine: 'line-through' },
  quantityPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11, maxWidth: 118 },
  quantityText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  clearButton: { minHeight: 43, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14 },
  clearText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  secondaryButton: { minHeight: 46, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pressed: { opacity: 0.7 },
});