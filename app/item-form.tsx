import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/state/Settings';
import { EMOJI_CHOICES, suggestEmoji } from '@/utils/emoji';
import { successFeedback } from '@/utils/haptics';
import { closeAfterKeyboard } from '@/utils/keyboard';
import { cleanPriceInput, formatPrice, priceInputValue, readPrice } from '@/utils/price';
import { cleanQuantityInput } from '@/utils/quantity';
import { MAX_NOTE_LENGTH, useStock, type StockItemDraft } from '@/state/StockContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function ChoiceChips({
  options,
  value,
  onSelect,
}: {
  options: string[];
  value: string;
  onSelect: (value: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = value.toLowerCase() === option.toLowerCase();
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.primary : colors.card,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selected ? colors.primaryForeground : colors.foreground },
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ItemFormScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const {
    items,
    recentLocations,
    recentStores,
    isLoading,
    saveItem,
    deleteItem,
  } = useStock();
  const existingItem = items.find((item) => item.id === itemId);
  const initialized = useRef(!itemId);
  const [name, setName] = useState(existingItem?.name ?? '');
  const [minimumQuantity, setMinimumQuantity] = useState(
    existingItem?.minimumQuantity.toString() ?? '',
  );
  const [restockQuantity, setRestockQuantity] = useState(
    existingItem?.restockQuantity.toString() ?? '',
  );
  const [unit, setUnit] = useState(existingItem?.unit ?? '');
  const [note, setNote] = useState(existingItem?.note ?? '');
  const [price, setPrice] = useState(priceInputValue(existingItem?.price));
  const { settings } = useSettings();
  const [location, setLocation] = useState(existingItem?.location ?? '');
  const [storeTypes, setStoreTypes] = useState<string[]>(
    existingItem?.storeTypes ?? [],
  );
  const [storeInput, setStoreInput] = useState('');
  // Empty means "pick one from the name".
  const [emoji, setEmoji] = useState(existingItem?.emoji ?? '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const shownEmoji = emoji || suggestEmoji(name);
  const [error, setError] = useState('');
  // Set once the screen starts closing, so a second tap can't save or close twice.
  const closingRef = useRef(false);
  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    closeAfterKeyboard(() => router.back());
  }

  useEffect(() => {
    if (!existingItem || initialized.current) return;
    initialized.current = true;
    setName(existingItem.name);
    setMinimumQuantity(existingItem.minimumQuantity.toString());
    setRestockQuantity(existingItem.restockQuantity.toString());
    setUnit(existingItem.unit);
    setNote(existingItem.note ?? '');
    setPrice(priceInputValue(existingItem.price));
    setLocation(existingItem.location);
    setStoreTypes(existingItem.storeTypes);
    setEmoji(existingItem.emoji ?? '');
  }, [existingItem]);

  function addStore(value = storeInput) {
    const cleanStore = value.trim();
    if (!cleanStore) return;
    setStoreTypes((current) =>
      current.some((store) => store.toLocaleLowerCase() === cleanStore.toLocaleLowerCase())
        ? current
        : [...current, cleanStore],
    );
    setStoreInput('');
    setError('');
  }

  function removeStore(storeToRemove: string) {
    setStoreTypes((current) => current.filter((store) => store !== storeToRemove));
  }

  function save() {
    if (closingRef.current) return;
    const cleanName = name.trim();
    const cleanLocation = location.trim();
    const cleanStores = [...new Set(storeTypes.map((store) => store.trim()).filter(Boolean))];
    const minimum = Number(minimumQuantity);
    const restock = Number(restockQuantity);

    if (!cleanName) {
      setError('Add a name for this item.');
      return;
    }
    if (!minimumQuantity.trim() || !Number.isInteger(minimum) || minimum < 0) {
      setError('Enter a whole number for the minimum quantity.');
      return;
    }
    if (!restockQuantity.trim() || !Number.isInteger(restock) || restock < 1) {
      setError('Enter a whole number greater than zero for how much to buy.');
      return;
    }
    if (!cleanLocation || cleanStores.length === 0) {
      setError('Add where you keep this item and where you buy it.');
      return;
    }

    const draft: StockItemDraft = {
      name: cleanName,
      minimumQuantity: minimum,
      restockQuantity: restock,
      unit: unit.trim(),
      location: cleanLocation,
      storeTypes: cleanStores,
      ...(emoji ? { emoji } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(readPrice(price) !== undefined ? { price: readPrice(price) } : {}),
    };
    const savedId = saveItem(draft, itemId);
    if (!savedId) {
      setError('An item with this name is already in your stock. Try another name.');
      return;
    }
    successFeedback();
    close();
  }

  function confirmDelete() {
    if (!itemId) return;
    Alert.alert('Remove this item?', `${name || 'This item'} will be removed from your stock list.`, [
      { text: 'Keep item', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteItem(itemId);
          close();
        },
      },
    ]);
  }

  const fieldStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close item form"
          onPress={close}
          style={styles.closeButton}
          testID="close-item-form"
        >
          <Feather name="x" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>
          {itemId ? 'Edit item' : 'New item'}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAwareScrollViewCompat
        bottomOffset={Platform.OS === 'web' ? 34 : 24}
        contentContainerStyle={[
          styles.form,
          { paddingBottom: insets.bottom + 30 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            {itemId ? 'Update your essential' : 'What do you keep at home?'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            A few details make your stock checks quick and your buy list useful.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>ITEM NAME</Text>
          <TextInput
            accessibilityLabel="Item name"
            autoCapitalize="sentences"
            onChangeText={(value) => {
              setName(value);
              if (error) setError('');
            }}
            placeholder="e.g. Milk"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="next"
            style={fieldStyle}
            testID="item-name-input"
            value={name}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>ICON</Text>
          <View style={styles.emojiRow}>
            <Pressable
              accessibilityLabel={`Icon ${shownEmoji}. Choose another`}
              accessibilityRole="button"
              accessibilityState={{ expanded: showEmojiPicker }}
              onPress={() => setShowEmojiPicker((current) => !current)}
              style={({ pressed }) => [
                styles.emojiPreview,
                { backgroundColor: colors.accent, borderColor: showEmojiPicker ? colors.primary : colors.accent },
                pressed && styles.pressed,
              ]}
              testID="item-emoji-button"
            >
              <Text style={styles.emojiPreviewText}>{shownEmoji}</Text>
            </Pressable>
            <View style={styles.emojiCopy}>
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                {emoji ? 'Your choice. Tap to change it.' : 'Picked from the name. Tap to choose your own.'}
              </Text>
              {emoji ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEmoji('')}
                  style={styles.emojiAuto}
                  testID="item-emoji-auto"
                >
                  <Text style={[styles.emojiAutoText, { color: colors.primary }]}>
                    Pick from the name instead
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {showEmojiPicker ? (
            <View style={[styles.emojiGrid, { backgroundColor: colors.card }]} testID="item-emoji-picker">
              {EMOJI_CHOICES.map((choice) => {
                const selected = choice === shownEmoji;
                return (
                  <Pressable
                    key={choice}
                    accessibilityLabel={`Use ${choice}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setEmoji(choice);
                      setShowEmojiPicker(false);
                    }}
                    style={[
                      styles.emojiChoice,
                      selected && { backgroundColor: colors.accent },
                    ]}
                    testID={`emoji-choice-${choice}`}
                  >
                    <Text style={styles.emojiChoiceText}>{choice}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.quantityRow}>
          <View style={[styles.fieldGroup, styles.quantityField]}>
            <Text style={[styles.label, { color: colors.foreground }]}>MINIMUM TO KEEP</Text>
            <TextInput
              accessibilityLabel="Minimum quantity"
              keyboardType="number-pad"
              onChangeText={(text) => setMinimumQuantity(cleanQuantityInput(text))}
              placeholder="2"
              placeholderTextColor={colors.mutedForeground}
              style={fieldStyle}
              testID="minimum-quantity-input"
              value={minimumQuantity}
            />
          </View>
          <View style={[styles.fieldGroup, styles.quantityField]}>
            <Text style={[styles.label, { color: colors.foreground }]}>BUY THIS MANY</Text>
            <TextInput
              accessibilityLabel="Restock quantity"
              keyboardType="number-pad"
              onChangeText={(text) => setRestockQuantity(cleanQuantityInput(text))}
              placeholder="4"
              placeholderTextColor={colors.mutedForeground}
              style={fieldStyle}
              testID="restock-quantity-input"
              value={restockQuantity}
            />
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>UNIT (OPTIONAL)</Text>
          <TextInput
            accessibilityLabel="Quantity unit"
            autoCapitalize="none"
            onChangeText={setUnit}
            placeholder="e.g. cartons, bottles, rolls"
            placeholderTextColor={colors.mutedForeground}
            style={fieldStyle}
            testID="item-unit-input"
            value={unit}
          />
        </View>

        {settings.showPrices ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              PRICE EACH (OPTIONAL{settings.currency ? `, ${settings.currency}` : ''})
            </Text>
            <TextInput
              accessibilityLabel="Price each"
              keyboardType="decimal-pad"
              onChangeText={(text) => setPrice(cleanPriceInput(text, settings.priceDecimals))}
              placeholder={`e.g. ${formatPrice(1.25, '', settings.priceDecimals)}`}
              placeholderTextColor={colors.mutedForeground}
              style={fieldStyle}
              testID="item-price-input"
              value={price}
            />
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>NOTE (OPTIONAL)</Text>
          <TextInput
            accessibilityLabel="Note"
            autoCapitalize="sentences"
            maxLength={MAX_NOTE_LENGTH}
            onChangeText={setNote}
            placeholder="e.g. Brand, size or flavour to get"
            placeholderTextColor={colors.mutedForeground}
            style={fieldStyle}
            testID="item-note-input"
            value={note}
          />
          <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
            Shown on your buy list, so whoever shops gets the right one.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>WHERE YOU KEEP IT</Text>
          <TextInput
            accessibilityLabel="Storage location"
            autoCapitalize="sentences"
            onChangeText={setLocation}
            placeholder="e.g. Fridge"
            placeholderTextColor={colors.mutedForeground}
            style={fieldStyle}
            testID="item-location-input"
            value={location}
          />
          {recentLocations.length > 0 ? (
            <>
              <Text style={[styles.helperLabel, { color: colors.mutedForeground }]}>
                RECENT LOCATIONS
              </Text>
              <ChoiceChips
                options={recentLocations}
                value={location}
                onSelect={setLocation}
              />
            </>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>WHERE YOU BUY IT</Text>
          <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
            Add every kind of store that sells this item.
          </Text>
          {storeTypes.length > 0 ? (
            <View style={styles.chips}>
              {storeTypes.map((store) => (
                <Pressable
                  key={store}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${store}`}
                  onPress={() => removeStore(store)}
                  style={[
                    styles.selectedStoreChip,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.selectedStoreText, { color: colors.primaryForeground }]}>
                    {store}
                  </Text>
                  <Feather name="x" size={13} color={colors.primaryForeground} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.storeEntryRow}>
            <TextInput
              accessibilityLabel="Add a store"
              autoCapitalize="sentences"
              onChangeText={setStoreInput}
              onSubmitEditing={() => addStore()}
              placeholder="e.g. Grocery store"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              style={[fieldStyle, styles.storeInput]}
              testID="item-store-input"
              value={storeInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add store"
              onPress={() => addStore()}
              style={({ pressed }) => [
                styles.addStoreButton,
                { backgroundColor: colors.secondary },
                pressed && styles.pressed,
              ]}
            >
              <Feather name="plus" size={17} color={colors.primary} />
            </Pressable>
          </View>
          {recentStores.length > 0 ? (
            <>
              <Text style={[styles.helperLabel, { color: colors.mutedForeground }]}>
                RECENT STORES
              </Text>
              <ChoiceChips
                options={recentStores.filter(
                  (store) =>
                    !storeTypes.some(
                      (selected) =>
                        selected.toLocaleLowerCase() === store.toLocaleLowerCase(),
                    ),
                )}
                value=""
                onSelect={addStore}
              />
            </>
          ) : null}
        </View>

        {error ? (
          <View style={[styles.errorMessage, { backgroundColor: colors.destructive }]}>
            <Feather name="alert-circle" size={15} color={colors.destructiveForeground} />
            <Text style={[styles.errorText, { color: colors.destructiveForeground }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={save}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: isLoading ? 0.5 : pressed ? 0.85 : 1 },
          ]}
          testID="save-item-button"
        >
          <Feather name="check" size={17} color={colors.primaryForeground} />
          <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
            {itemId ? 'Save changes' : 'Add to my stock'}
          </Text>
        </Pressable>

        {itemId ? (
          <Pressable
            accessibilityRole="button"
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
            testID="delete-item-button"
          >
            <Feather name="trash-2" size={15} color={colors.destructive} />
            <Text style={[styles.deleteText, { color: colors.destructive }]}>
              Remove from stock
            </Text>
          </Pressable>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  form: { paddingHorizontal: 22, gap: 18 },
  intro: { gap: 7, marginTop: 10, marginBottom: 3 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 25, lineHeight: 31, letterSpacing: -0.6 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  fieldGroup: { gap: 8 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  helperLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1 },
  fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  input: { minHeight: 49, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Inter_500Medium', fontSize: 14 },
  emojiRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiPreview: { height: 56, width: 56, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  emojiPreviewText: { fontSize: 28 },
  emojiCopy: { flex: 1, gap: 4 },
  emojiAuto: { alignSelf: 'flex-start', paddingVertical: 2 },
  emojiAutoText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 8, borderRadius: 16 },
  emojiChoice: { height: 44, width: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emojiChoiceText: { fontSize: 23 },
  quantityRow: { flexDirection: 'row', gap: 12 },
  quantityField: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 1 },
  chip: { minHeight: 31, justifyContent: 'center', borderWidth: 1, borderRadius: 11, paddingHorizontal: 10 },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  selectedStoreChip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 10 },
  selectedStoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  storeEntryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storeInput: { flex: 1 },
  addStoreButton: { width: 48, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  errorMessage: { padding: 12, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  saveButton: { minHeight: 51, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 2 },
  saveText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  deleteButton: { minHeight: 46, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pressed: { opacity: 0.7 },
});