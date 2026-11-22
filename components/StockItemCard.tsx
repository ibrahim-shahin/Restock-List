import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { StockItem } from '@/state/StockContext';
import { itemEmoji } from '@/utils/emoji';

type Props = {
  item: StockItem;
  // Stores where the item is on the buy list, not yet ticked off.
  listedStores: string[];
  onEdit: () => void;
  onAddToBuyList: (store: string) => void;
};

export function StockItemCard({ item, listedStores, onEdit, onAddToBuyList }: Props) {
  const colors = useColors();
  const [choosingStore, setChoosingStore] = useState(false);
  const isListed = listedStores.length > 0;
  const canAdd = item.storeTypes.some((store) => !listedStores.includes(store));

  function add() {
    // One place to buy it: add it there. Several: ask which.
    if (item.storeTypes.length === 1) {
      onAddToBuyList(item.storeTypes[0]);
    } else {
      setChoosingStore((current) => !current);
    }
  }

  const addLabel = !isListed
    ? `Add ${item.name} to the buy list`
    : canAdd
      ? `${item.name} is on the buy list for ${listedStores.join(', ')}. Add it for another store`
      : `${item.name} is on the buy list`;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          onPress={onEdit}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
          testID={`stock-item-${item.id}`}
        >
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Text style={styles.emoji}>{itemEmoji(item)}</Text>
          </View>
          <View style={styles.details}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.metaLine}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.location}
              </Text>
              <View style={[styles.dot, { backgroundColor: colors.border }]} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.storeTypes.join(', ')}
              </Text>
            </View>
          </View>
          {item.minimumQuantity !== undefined ? (
            <View style={styles.quantity} testID={`minimum-${item.id}`}>
              <Text style={[styles.quantityNumber, { color: colors.foreground }]}>
                {item.minimumQuantity}
              </Text>
              <Text style={[styles.quantityLabel, { color: colors.mutedForeground }]}>min</Text>
            </View>
          ) : null}
        </Pressable>
        {/* A sibling of the main button, not inside it, so screen readers can reach both. */}
        <Pressable
          accessibilityLabel={addLabel}
          accessibilityRole="button"
          accessibilityState={{
            disabled: !canAdd,
            ...(item.storeTypes.length > 1 && canAdd ? { expanded: choosingStore } : {}),
          }}
          disabled={!canAdd}
          hitSlop={6}
          onPress={add}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: isListed ? colors.primary : colors.secondary },
            pressed && styles.pressed,
          ]}
          testID={`add-to-buy-list-${item.id}`}
        >
          <Feather
            name={isListed ? 'check' : 'shopping-bag'}
            size={17}
            color={isListed ? colors.primaryForeground : colors.primary}
          />
          {!isListed ? (
            <View style={[styles.plusBadge, { backgroundColor: colors.primary, borderColor: colors.secondary }]}>
              <Feather name="plus" size={8} color={colors.primaryForeground} />
            </View>
          ) : null}
        </Pressable>
      </View>

      {choosingStore && canAdd ? (
        <View style={[styles.storeChoice, { borderTopColor: colors.border }]} testID={`choose-store-for-${item.id}`}>
          <Text style={[styles.storeChoiceLabel, { color: colors.mutedForeground }]}>
            Add to the buy list for
          </Text>
          <View style={styles.storeChips}>
            {item.storeTypes.map((store) => {
              const listed = listedStores.includes(store);
              return (
                <Pressable
                  key={store}
                  accessibilityLabel={listed ? `${item.name} is on the list for ${store}` : `Add for ${store}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: listed }}
                  disabled={listed}
                  onPress={() => {
                    setChoosingStore(false);
                    onAddToBuyList(store);
                  }}
                  style={({ pressed }) => [
                    styles.storeChip,
                    {
                      backgroundColor: listed ? colors.accent : colors.background,
                      borderColor: listed ? colors.accent : colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                  testID={`add-to-buy-list-${item.id}-${store}`}
                >
                  {listed ? <Feather name="check" size={12} color={colors.primary} /> : null}
                  <Text style={[styles.storeChipText, { color: listed ? colors.primary : colors.foreground }]}>
                    {store}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  row: { minHeight: 80, flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  main: {
    flex: 1,
    alignSelf: 'stretch',
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { opacity: 0.76 },
  icon: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 21 },
  details: { flex: 1, gap: 6 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, flexShrink: 1 },
  dot: { height: 3, width: 3, borderRadius: 2, marginHorizontal: 2 },
  quantity: { alignItems: 'center', minWidth: 30 },
  quantityNumber: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  quantityLabel: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  addButton: { height: 44, width: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  plusBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    height: 13,
    width: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeChoice: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  storeChoiceLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  storeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  storeChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  storeChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
