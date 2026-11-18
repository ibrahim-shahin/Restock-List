import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused } from 'expo-router';
import React, { useEffect, useEffectEvent, useState } from 'react';
import {
  BackHandler,
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
import {
  nextAnswers,
  orderByPlace,
  placeProgress,
  previousAnswers,
  shortItemIds,
} from '@/utils/stockCheck';

export default function StockCheckScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, createBuyList } = useStock();
  const [selectedStoreType, setSelectedStoreType] = useState<string | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const storeTypes = [...new Set(items.flatMap((item) => item.storeTypes))];
  // Checked place by place, so everything in one room comes one after another.
  const storeItems = selectedStoreType
    ? orderByPlace(items.filter((item) => item.storeTypes.includes(selectedStoreType)))
    : [];
  const currentIndex = answers.length;
  const isComplete = storeItems.length > 0 && currentIndex >= storeItems.length;
  const shortItems = shortItemIds(storeItems.map((item) => item.id), answers);
  const currentItem = storeItems[currentIndex];
  const place = placeProgress(storeItems, currentIndex);
  const progress = storeItems.length
    ? (currentIndex / storeItems.length) * 100
    : 0;

  function chooseAnotherStore() {
    setSelectedStoreType(null);
    setAnswers([]);
  }

  function answer(hasEnough: boolean) {
    if (!currentItem) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = nextAnswers(answers, hasEnough, storeItems.length);
    setAnswers(next);
    if (next.length === storeItems.length) {
      createBuyList(
        shortItemIds(storeItems.map((item) => item.id), next),
        selectedStoreType ?? '',
      );
    }
  }

  // Going back from the result re-opens the last item; answering it again
  // rebuilds that store's buy list.
  function goBackOneItem() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers((current) => previousAnswers(current));
  }

  // Android's back button leaves the store's check for the store list, like
  // the arrow at the top; "Previous item" is the way to undo an answer. It
  // only listens while this screen is showing, so a screen opened on top
  // gets the back button.
  const isFocused = useIsFocused();
  const isChecking = selectedStoreType !== null && !isComplete;
  const onHardwareBack = useEffectEvent(() => chooseAnotherStore());
  useEffect(() => {
    if (!isChecking || !isFocused) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onHardwareBack();
      return true;
    });
    return () => subscription.remove();
  }, [isChecking, isFocused]);

  function viewBuyList() {
    router.dismissTo('/(tabs)/shopping');
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
              Choose a store and we’ll check the items you buy there, one storage place at a time.
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
                    setAnswers([]);
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
          <Pressable
            accessibilityRole="button"
            onPress={goBackOneItem}
            style={({ pressed }) => [styles.backStepButton, pressed && styles.pressed]}
            testID="change-last-answer-button"
          >
            <Feather name="corner-up-left" size={14} color={colors.mutedForeground} />
            <Text style={[styles.backStepText, { color: colors.mutedForeground }]}>
              Change my last answer
            </Text>
          </Pressable>
        </View>
      ) : currentItem ? (
        <View style={styles.checkArea}>
          <ScrollView
            contentContainerStyle={styles.checkContent}
            showsVerticalScrollIndicator
            style={styles.checkScroll}
            testID="check-scroll"
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
              {place ? (
                <View
                  accessibilityLabel={`${place.place}, item ${place.position} of ${place.count} here`}
                  style={[styles.placePill, { backgroundColor: colors.card, borderColor: colors.border }]}
                  testID="check-place"
                >
                  <Feather name="map-pin" size={13} color={colors.primary} />
                  <Text style={[styles.placeName, { color: colors.foreground }]} numberOfLines={1}>
                    {place.place}
                  </Text>
                  <Text style={[styles.placeCount, { color: colors.mutedForeground }]}>
                    {place.position} of {place.count}
                  </Text>
                </View>
              ) : null}
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
              {place?.nextPlace && place.position === place.count ? (
                <View style={styles.locationLine} testID="next-place">
                  <Feather name="corner-down-right" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
                    Next: {place.nextPlace}
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          {/* Pinned under the question, so nothing above can move them. */}
          <View style={[styles.answers, { paddingBottom: insets.bottom + 16 }]}>
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
                {/* Repeats the number, so it shows even when the question has to scroll. */}
                <Text style={[styles.answerTitle, { color: colors.foreground }]}>
                  {currentItem.minimumQuantity > 0
                    ? `Yes, I have at least ${currentItem.minimumQuantity}${currentItem.unit ? ` ${currentItem.unit}` : ''}`
                    : 'Yes, I have enough'}
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
              {/* Always takes up its space, so Yes and No stay put when it appears. */}
              <Pressable
                accessibilityElementsHidden={currentIndex === 0}
                accessibilityRole="button"
                accessibilityState={{ disabled: currentIndex === 0 }}
                disabled={currentIndex === 0}
                importantForAccessibility={currentIndex === 0 ? 'no-hide-descendants' : 'auto'}
                onPress={goBackOneItem}
                style={({ pressed }) => [
                  styles.backStepButton,
                  currentIndex === 0 && styles.hidden,
                  pressed && styles.pressed,
                ]}
                testID="previous-item-button"
              >
                <Feather name="corner-up-left" size={14} color={colors.mutedForeground} />
                <Text style={[styles.backStepText, { color: colors.mutedForeground }]}>
                  Previous item
                </Text>
              </Pressable>
            </View>
        </View>
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
  checkArea: { flex: 1 },
  checkScroll: { flex: 1 },
  checkContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  stepText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  percentText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  progressTrack: { height: 4, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 4 },
  questionBlock: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  placePill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '90%', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 18 },
  placeName: { fontFamily: 'Inter_700Bold', fontSize: 12, flexShrink: 1 },
  placeCount: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  itemIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  itemName: { fontFamily: 'Inter_700Bold', fontSize: 28, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
  question: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  minimumBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 6, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10, marginTop: 11, marginBottom: 9 },
  minimumValue: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  minimumUnit: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  questionSuffix: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  locationText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  answers: { gap: 11, paddingHorizontal: 24, paddingTop: 10 },
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
  backStepButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 6 },
  backStepText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  hidden: { opacity: 0 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});