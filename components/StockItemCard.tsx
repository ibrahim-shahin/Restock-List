import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { StockItem } from '@/state/StockContext';
import { itemEmoji } from '@/utils/emoji';

type Props = {
  item: StockItem;
  onEdit: () => void;
};

export function StockItemCard({ item, onEdit }: Props) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.name}`}
      onPress={onEdit}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
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
          <Text
            style={[styles.meta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {item.location}
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.border }]} />
          <Text
            style={[styles.meta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {item.storeTypes.join(', ')}
          </Text>
        </View>
      </View>
      <View style={styles.quantity}>
        <Text style={[styles.quantityNumber, { color: colors.foreground }]}>
          {item.minimumQuantity}
        </Text>
        <Text style={[styles.quantityLabel, { color: colors.mutedForeground }]}>
          min
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  icon: {
    height: 42,
    width: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 21 },
  details: { flex: 1, gap: 6 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, flexShrink: 1 },
  dot: { height: 3, width: 3, borderRadius: 2, marginHorizontal: 2 },
  quantity: { alignItems: 'center', minWidth: 30 },
  quantityNumber: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  quantityLabel: { fontFamily: 'Inter_400Regular', fontSize: 10 },
});