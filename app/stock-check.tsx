import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useStock } from '@/state/StockContext';

export default function StockCheckScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, createBuyList } = useStock();
  const [selectedStoreType, setSelectedStoreType] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shortItems, setShortItems] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const storeTypes = [...new Set(items.flatMap((item) => item.storeTypes))];
  const storeItems = selectedStoreType
    ? items.filter((item) => item.storeTypes.includes(selectedStoreType))
    : [];
  const currentItem = storeItems[currentIndex];
  const progress = storeItems.length
    ? (currentIndex / storeItems.length) * 100
    : 0;

  function chooseAnotherStore() {
    setSelectedStoreType(null);
    setCurrentIndex(0);
    setShortItems([]);
    setIsComplete(false);
  }

  function answer(hasEnough: boolean) {
    if (!currentItem) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextShortItems = hasEnough
      ? shortItems
      : [...shortItems, currentItem.id];

    if (currentIndex + 1 >= storeItems.length) {
      setShortItems(nextShortItems);
      createBuyList(nextShortItems, selectedStoreType ?? '');
      setIsComplete(true);
      return;
    }

    if (!hasEnough) setShortItems(nextShortItems);
    setCurrentIndex((index) => index + 1);
  }

  function viewBuyList() {
    router.replace('/(tabs)/shopping');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.top,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8) },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            selectedStoreType ? 'Choose a different store' : 'Close stock check'
          }
          onPress={() =>
            selectedStoreType ? chooseAnotherStore() : router.back()
          }
          style={styles.closeButton}
          testID="close-stock-check"
        >
          <Feather
            name={selectedStoreType ? 'arrow-left' : 'x'}
            size={21}
            color={colors.foreground}
          />
        </Pressable>
        <Text
          style={[styles.topLabel, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {selectedStoreType ?? 'STOCK CHECK'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.bigIcon, { backgroundColor: colors.accent }]}>
            <Feather name="archive" size={25} color={colors.primary} />
          </View>
          <Text style={[styles.completeTitle, { color: colors.foreground }]}>
            Nothing to check yet
          </Text>
          <Text style={[styles.completeCopy, { color: colors.mutedForeground }]}>
            Add the essentials you want to keep an eye on, then come back for a quick check.
          </Text>
          <Pressable
            onPress={() => router.push('/item-form')}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            testID="add-item-from-check"
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              Add an item
            </Text>
          </Pressable>
        </View>
      ) : !selectedStoreType ? (
        <ScrollView
          contentContainerStyle={[
            styles.storePickerContent,
            { paddingBottom: insets.bottom + 28 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.storeIntro}>
            <View style={[styles.bigIcon, { backgroundColor: colors.accent }]}>
              <Feather name="map-pin" size={23} color={colors.primary} />
            </View>
            <Text style={[styles.completeTitle, { color: colors.foreground }]}>
              Where are you going?
            </Text>
            <Text style={[styles.completeCopy, { color: colors.mutedForeground }]}>
              Choose a store and we’ll only check items you buy there.
            </Text>
          </View>
          <View style={styles.storeOptions}>
            {storeTypes.map((storeType) => {
              const count = items.filter((item) => item.storeTypes.includes(storeType)).length;
              return (
                <Pressable
                  key={storeType}
                  accessibilityRole="button"
                  onPress={() => {
                    setCurrentIndex(0);
                    setShortItems([]);
                    setIsComplete(false);
                    setSelectedStoreType(storeType);
                  }}
                  style={({ pressed }) => [
                    styles.storeOption,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                  testID={`choose-store-${storeType}`}
                >
                  <View style={[styles.storeOptionIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="shopping-bag" size={17} color={colors.primary} />
                  </View>
                  <View style={styles.storeOptionCopy}>
                    <Text
                      style={[styles.storeOptionTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {storeType}
                    </Text>
                    <Text style={[styles.storeOptionCount, { color: colors.mutedForeground }]}>
                      {count} {count === 1 ? 'item' : 'items'} to check
                    </Text>
                  </View>
                  <Feather name="arrow-right" size={17} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : isComplete ? (
        <View style={styles.centered}>
          <View style={[styles.bigIcon, { backgroundColor: colors.accent }]}>
            <Feather
              name={shortItems.length === 0 ? 'check' : 'shopping-bag'}
              size={25}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.completeTitle, { color: colors.foreground }]}>
            {shortItems.length === 0 ? 'You’re all stocked up' : 'Buy list is ready'}
          </Text>
          <Text style={[styles.completeCopy, { color: colors.mutedForeground }]}>
            {shortItems.length === 0
              ? `Everything at ${selectedStoreType} is at or above its minimum. Your other store sections stay on the list.`
              : `${shortItems.length} ${shortItems.length === 1 ? 'item needs' : 'items need'} a restock at ${selectedStoreType}. Other store sections stay on your list.`}
          </Text>
          <Pressable
            onPress={viewBuyList}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            testID="view-buy-list-button"
          >
            <Feather name="shopping-bag" size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              View buy list
            </Text>
          </Pressable>
          <Pressable
            onPress={chooseAnotherStore}
            style={({ pressed }) => [
              styles.anotherStoreButton,
              { backgroundColor: colors.secondary },
              pressed && styles.pressed,
            ]}
            testID="check-another-store-button"
          >
            <Feather name="repeat" size={15} color={colors.primary} />
            <Text style={[styles.anotherStoreText, { color: colors.primary }]}>
              Check another store
            </Text>
          </Pressable>
        </View>
      ) : currentItem ? (
        <ScrollView
          contentContainerStyle={[
            styles.checkContent,
            { paddingBottom: insets.bottom + 28 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressHeader}>
            <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
              ITEM {currentIndex + 1} OF {storeItems.length}
            </Text>
            <Text style={[styles.percentText, { color: colors.primary }]}>
              {Math.round(progress)}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${progress}%` },
              ]}
            />
          </View>

          <View style={styles.questionBlock}>
            <View style={[styles.itemIcon, { backgroundColor: colors.accent }]}>
              <Feather name="package" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.itemName, { color: colors.foreground }]}>
              {currentItem.name}
            </Text>
            <Text style={[styles.question, { color: colors.mutedForeground }]}>
              Do you have at least
            </Text>
            <View style={[styles.minimumBadge, { backgroundColor: colors.card }]}>
              <Text style={[styles.minimumValue, { color: colors.primary }]}>
                {currentItem.minimumQuantity}
              </Text>
              {currentItem.unit ? (
                <Text style={[styles.minimumUnit, { color: colors.primary }]}>
                  {currentItem.unit}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.questionSuffix, { color: colors.mutedForeground }]}>
              on hand?
            </Text>
            <View style={styles.locationLine}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
                Check {currentItem.location.toLowerCase()} · {selectedStoreType}
              </Text>
            </View>
          </View>

          <View style={styles.answers}>
            <Pressable
              accessibilityRole="button"
              onPress={() => answer(true)}
              style={({ pressed }) => [
                styles.answerButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              testID="stock-answer-yes"
            >
              <View style={[styles.answerIcon, { backgroundColor: colors.accent }]}>
                <Feather name="check" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.answerTitle, { color: colors.foreground }]}>
                Yes, I have enough
              </Text>
              <Feather name="arrow-right" size={17} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => answer(false)}
              style={({ pressed }) => [
                styles.answerButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              testID="stock-answer-no"
            >
              <View style={[styles.answerIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="plus" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.answerTitle, { color: colors.foreground }]}>
                No, add it to my list
              </Text>
              <Feather name="arrow-right" size={17} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: 22, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center' },
  topLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, maxWidth: '65%', textAlign: 'center' },
  storePickerContent: { flexGrow: 1, paddingHorizontal: 23, justifyContent: 'center', gap: 30 },
  storeIntro: { alignItems: 'center', gap: 10 },
  storeOptions: { gap: 10 },
  storeOption: { minHeight: 73, borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 12 },
  storeOptionIcon: { height: 41, width: 41, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  storeOptionCopy: { flex: 1, gap: 4 },
  storeOptionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  storeOptionCount: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  checkContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, justifyContent: 'space-between' },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  stepText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  percentText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  progressTrack: { height: 4, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 4 },
  questionBlock: { alignItems: 'center', paddingTop: 44, paddingBottom: 38 },
  itemIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  itemName: { fontFamily: 'Inter_700Bold', fontSize: 28, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
  question: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  minimumBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 6, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10, marginTop: 11, marginBottom: 9 },
  minimumValue: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  minimumUnit: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  questionSuffix: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  locationText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  answers: { gap: 11, paddingBottom: 8 },
  answerButton: { minHeight: 68, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  answerIcon: { height: 40, width: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  answerTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 35 },
  bigIcon: { height: 66, width: 66, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  completeTitle: { fontFamily: 'Inter_700Bold', fontSize: 23, letterSpacing: -0.4, textAlign: 'center' },
  completeCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 9, maxWidth: 300 },
  primaryButton: { minHeight: 49, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 20, marginTop: 23 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  anotherStoreButton: { minHeight: 46, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, marginTop: 10 },
  anotherStoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});