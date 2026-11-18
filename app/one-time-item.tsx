import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useStock } from '@/state/StockContext';
import { cleanQuantityInput } from '@/utils/quantity';

function uniqueStores(stores: string[]): string[] {
  const seen = new Set<string>();
  return stores.filter((store) => {
    const key = store.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function OneTimeItemScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ store?: string | string[] }>();
  const { items, shoppingList, recentStores, isLoading, addOneTimeItem } = useStock();
  const knownStores = uniqueStores([
    ...shoppingList.map((entry) => entry.shoppingStoreType),
    ...items.flatMap((item) => item.storeTypes),
    ...recentStores,
  ]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  // A link can repeat a parameter; use its first value.
  const storeParam = Array.isArray(params.store) ? params.store[0] : params.store;
  // The tapped store and what's typed in the field; typing wins.
  const [chosenStore, setChosenStore] = useState(
    storeParam ?? (knownStores.length === 1 ? knownStores[0] : ''),
  );
  const [typedStore, setTypedStore] = useState('');
  const store = typedStore.trim() ? typedStore : chosenStore;
  const [error, setError] = useState('');

  function save() {
    const message = addOneTimeItem({
      name,
      quantity: Number(quantity || '1'),
      unit,
      store,
    });
    if (message) {
      setError(message);
      return;
    }
    router.back();
  }

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.closeButton}
          testID="close-one-time-item"
        >
          <Feather name="x" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>One-time item</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 30 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Need something just this once?
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {"It goes on your buy list for this trip only. It won't be added to your stock or your stock checks."}
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>WHAT DO YOU NEED?</Text>
          <TextInput
            accessibilityLabel="What you need"
            autoCapitalize="sentences"
            autoFocus
            onChangeText={(value) => {
              setName(value);
              if (error) setError('');
            }}
            placeholder="e.g. Birthday candles"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="next"
            style={fieldStyle}
            testID="one-time-name-input"
            value={name}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.fieldGroup, styles.quantityField]}>
            <Text style={[styles.label, { color: colors.foreground }]}>HOW MANY</Text>
            <TextInput
              accessibilityLabel="How many"
              keyboardType="number-pad"
              onChangeText={(text) => setQuantity(cleanQuantityInput(text))}
              placeholder="1"
              placeholderTextColor={colors.mutedForeground}
              selectTextOnFocus
              style={fieldStyle}
              testID="one-time-quantity-input"
              value={quantity}
            />
          </View>
          <View style={[styles.fieldGroup, styles.unitField]}>
            <Text style={[styles.label, { color: colors.foreground }]}>UNIT (OPTIONAL)</Text>
            <TextInput
              accessibilityLabel="Unit"
              autoCapitalize="none"
              onChangeText={setUnit}
              placeholder="e.g. packs"
              placeholderTextColor={colors.mutedForeground}
              style={fieldStyle}
              testID="one-time-unit-input"
              value={unit}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>WHERE WILL YOU BUY IT?</Text>
          {knownStores.length > 0 ? (
            <View style={styles.chips}>
              {knownStores.map((option) => {
                const selected = option.toLocaleLowerCase() === store.trim().toLocaleLowerCase();
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setChosenStore(option);
                      setTypedStore('');
                      if (error) setError('');
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    testID={`one-time-store-${option}`}
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
          ) : null}
          <TextInput
            accessibilityLabel="Another store"
            autoCapitalize="sentences"
            onChangeText={(value) => {
              setTypedStore(value);
              if (error) setError('');
            }}
            onSubmitEditing={save}
            placeholder={knownStores.length > 0 ? 'Or type another store' : 'e.g. Pharmacy'}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
            style={fieldStyle}
            testID="one-time-store-input"
            value={typedStore}
          />
        </View>

        {error ? (
          <View style={[styles.errorMessage, { backgroundColor: colors.destructive }]}>
            <Feather name="alert-circle" size={15} color={colors.destructiveForeground} />
            <Text
              accessibilityRole="alert"
              style={[styles.errorText, { color: colors.destructiveForeground }]}
            >
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
          testID="save-one-time-item"
        >
          <Feather name="plus" size={17} color={colors.primaryForeground} />
          <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
            Add to buy list
          </Text>
        </Pressable>
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
  input: { minHeight: 49, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Inter_500Medium', fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  quantityField: { flex: 2 },
  unitField: { flex: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 34, justifyContent: 'center', borderWidth: 1, borderRadius: 11, paddingHorizontal: 11 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  errorMessage: { padding: 12, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  saveButton: { minHeight: 51, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 2 },
  saveText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});
