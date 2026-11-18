import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/state/Settings';
import { useStock } from '@/state/StockContext';
import { movePlace, orderPlaces } from '@/utils/stockCheck';

export default function CheckRouteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items } = useStock();
  const { settings, updateSettings } = useSettings();
  const places = orderPlaces(
    items.map((item) => item.location),
    settings.placeOrder,
  );

  function move(index: number, step: -1 | 1) {
    updateSettings({ placeOrder: movePlace(places, index, step) });
  }

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
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Stock check route</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Feather name="map" size={21} color={colors.primary} />
          </View>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Your route through the home
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Stock checks visit your storage places in this order. Put them in the order you walk through your home, so you never double back.
          </Text>
        </View>

        {places.length === 0 ? (
          <View style={[styles.card, styles.empty, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add items with a storage place first, and they will show up here.
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {places.map((place, index) => (
              <View
                key={place}
                style={[
                  styles.placeRow,
                  index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
                testID={`route-place-${index}`}
              >
                <View style={[styles.stepNumber, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.stepNumberText, { color: colors.primary }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.placeName, { color: colors.foreground }]} numberOfLines={1}>
                  {place}
                </Text>
                <Pressable
                  accessibilityLabel={`Move ${place} earlier`}
                  accessibilityRole="button"
                  disabled={index === 0}
                  hitSlop={4}
                  onPress={() => move(index, -1)}
                  style={({ pressed }) => [
                    styles.moveButton,
                    { backgroundColor: colors.secondary, opacity: index === 0 ? 0.35 : pressed ? 0.7 : 1 },
                  ]}
                  testID={`move-up-${index}`}
                >
                  <Feather name="arrow-up" size={16} color={colors.primary} />
                </Pressable>
                <Pressable
                  accessibilityLabel={`Move ${place} later`}
                  accessibilityRole="button"
                  disabled={index === places.length - 1}
                  hitSlop={4}
                  onPress={() => move(index, 1)}
                  style={({ pressed }) => [
                    styles.moveButton,
                    {
                      backgroundColor: colors.secondary,
                      opacity: index === places.length - 1 ? 0.35 : pressed ? 0.7 : 1,
                    },
                  ]}
                  testID={`move-down-${index}`}
                >
                  <Feather name="arrow-down" size={16} color={colors.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {settings.placeOrder.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => updateSettings({ placeOrder: [] })}
            style={({ pressed }) => [
              styles.resetButton,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
            testID="reset-route-button"
          >
            <Feather name="rotate-ccw" size={14} color={colors.mutedForeground} />
            <Text style={[styles.resetText, { color: colors.mutedForeground }]}>
              Go back to A–Z
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          New storage places go at the end until you move them.
        </Text>
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
  card: { borderRadius: 19, paddingHorizontal: 14 },
  empty: { paddingVertical: 18 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  placeRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumber: { height: 28, width: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  placeName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  moveButton: { height: 36, width: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resetButton: { minHeight: 44, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  resetText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 12 },
  pressed: { opacity: 0.7 },
});
