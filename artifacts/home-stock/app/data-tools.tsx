import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useStock } from '@/state/StockContext';
import { router } from 'expo-router';

export default function DataToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, importItems, isLoading } = useStock();
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');

  async function exportItems() {
    if (items.length === 0) {
      Alert.alert('No items to export', 'Add items to your stock list first.');
      return;
    }
    const backup = {
      format: 'home-stock-items',
      version: 2,
      exportedAt: new Date().toISOString(),
      items,
    };
    try {
      await Share.share({
        title: 'Home Stock inventory JSON',
        message: JSON.stringify(backup, null, 2),
      });
    } catch {
      Alert.alert('Could not export', 'Please try sharing your inventory again.');
    }
  }

  function importJson() {
    if (!jsonText.trim()) {
      setError('Paste your exported JSON above first.');
      return;
    }
    try {
      const result = importItems(JSON.parse(jsonText) as unknown);
      setJsonText('');
      setError('');
      const summary = `${result.importedCount} ${result.importedCount === 1 ? 'item was' : 'items were'} added.`;
      const skipped = result.skippedCount
        ? ` ${result.skippedCount} duplicate ${result.skippedCount === 1 ? 'item was' : 'items were'} skipped.`
        : '';
      Alert.alert('Import complete', `${summary}${skipped} Your existing items were kept.`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'This JSON could not be imported. Check that it came from a Home Stock export.',
      );
    }
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
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Import & export</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Feather name="archive" size={21} color={colors.primary} />
          </View>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Keep a copy of your stock
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Export a JSON backup to another app, or paste a backup here to bring items in.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Export items
          </Text>
          <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
            Share all {items.length} {items.length === 1 ? 'item' : 'items'} as JSON using your phone’s share menu.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading || items.length === 0}
            onPress={() => void exportItems()}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: isLoading || items.length === 0 ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
            testID="export-items-button"
          >
            <Feather name="share-2" size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              Export JSON
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Import items
          </Text>
          <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
            Paste the JSON you exported. Items are merged into your stock; existing items are never removed, and duplicate IDs are skipped.
          </Text>
          <TextInput
            accessibilityLabel="Paste inventory JSON"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={(text) => {
              setJsonText(text);
              if (error) setError('');
            }}
            placeholder={'Paste JSON here, for example:\n{"items":[...]} '}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.jsonInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            textAlignVertical="top"
            value={jsonText}
            testID="import-json-input"
          />
          {error ? (
            <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isLoading || !jsonText.trim()}
            onPress={importJson}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: colors.secondary,
                opacity: isLoading || !jsonText.trim() ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
            testID="import-json-button"
          >
            <Feather name="download" size={16} color={colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Import and merge
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
          Your inventory stays on this device unless you choose to share an export.
        </Text>
      </KeyboardAwareScrollViewCompat>
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
  card: { borderRadius: 19, padding: 16, gap: 11 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  cardCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  primaryButton: { minHeight: 47, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  jsonInput: { minHeight: 165, maxHeight: 300, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  secondaryButton: { minHeight: 47, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  privacyNote: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 12 },
});