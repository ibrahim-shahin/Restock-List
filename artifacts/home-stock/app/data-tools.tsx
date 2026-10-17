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
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useStock } from '@/state/StockContext';
import { router } from 'expo-router';

export default function DataToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    items,
    shoppingList,
    recentLocations,
    recentStores,
    importBackup,
    isLoading,
    cloudSyncStatus,
    cloudSyncError,
    syncNow,
  } = useStock();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const accountSignedIn = isSignedIn === true;
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');

  async function exportItems() {
    if (
      items.length === 0 &&
      shoppingList.length === 0 &&
      recentLocations.length === 0 &&
      recentStores.length === 0
    ) {
      Alert.alert('No data to export', 'Add something to your stock first.');
      return;
    }
    const backup = {
      format: 'home-stock-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      items,
      shoppingList,
      recentLocations,
      recentStores,
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
      const result = importBackup(JSON.parse(jsonText) as unknown);
      setJsonText('');
      setError('');
      const summary = `${result.importedCount} ${result.importedCount === 1 ? 'item was' : 'items were'} added.`;
      const skipped = result.skippedCount
        ? ` ${result.skippedCount} duplicate ${result.skippedCount === 1 ? 'item was' : 'items were'} skipped.`
        : '';
      const listSummary = result.shoppingListAddedCount
        ? ` ${result.shoppingListAddedCount} buy-list ${result.shoppingListAddedCount === 1 ? 'entry was' : 'entries were'} added.`
        : '';
      Alert.alert(
        'Import complete',
        `${summary}${listSummary}${skipped} Your existing data was kept.`,
      );
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
            {accountSignedIn
              ? 'Your account syncs automatically. You can also export a complete JSON backup or import one here.'
              : 'Sign-in is optional. Your guest stock stays on this device; sign in later to sync it across devices.'}
          </Text>
        </View>

        {accountSignedIn ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Cloud sync
            </Text>
            <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
              Signed in as {user?.primaryEmailAddress?.emailAddress ?? 'your account'}.
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={[
                styles.syncStatus,
                {
                  color:
                    cloudSyncStatus === 'error'
                      ? colors.destructive
                      : colors.mutedForeground,
                },
              ]}
            >
              {cloudSyncError ??
                (cloudSyncStatus === 'syncing'
                  ? 'Syncing your stock…'
                  : 'Your latest stock is saved to your account.')}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading || cloudSyncStatus === 'syncing'}
              onPress={() => void syncNow()}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: colors.secondary,
                  opacity:
                    isLoading || cloudSyncStatus === 'syncing'
                      ? 0.5
                      : pressed
                        ? 0.8
                        : 1,
                },
              ]}
              testID="sync-now-button"
            >
              <Feather name="refresh-cw" size={16} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                {cloudSyncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  'Sign out?',
                  'Your account stock stays saved to your account. Guest mode will not show account-only changes.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out',
                      style: 'destructive',
                      onPress: () => void signOut(),
                    },
                  ],
                )
              }
              style={({ pressed }) => [
                styles.textButton,
                { opacity: pressed ? 0.65 : 1 },
              ]}
              testID="sign-out-button"
            >
              <Text style={[styles.textButtonText, { color: colors.mutedForeground }]}>
                Sign out
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Sync across your devices
            </Text>
            <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
              A guest list can be linked to one account. Sign in to sync it across devices; account-only changes stay private.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={() => router.push('/(auth)/sign-in')}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: isLoading ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
              testID="guest-sign-in-button"
            >
              <Feather name="log-in" size={16} color={colors.primaryForeground} />
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                Sign in
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={() => router.push('/(auth)/sign-up')}
              style={({ pressed }) => [
                styles.textButton,
                { opacity: isLoading ? 0.5 : pressed ? 0.65 : 1 },
              ]}
              testID="guest-create-account-button"
            >
              <Text style={[styles.textButtonText, { color: colors.primary }]}>
                Create an account
              </Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Export a full backup
          </Text>
          <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
            Share {items.length} {items.length === 1 ? 'item' : 'items'}, your buy list, and saved places as JSON.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={
              isLoading ||
              (items.length === 0 &&
                shoppingList.length === 0 &&
                recentLocations.length === 0 &&
                recentStores.length === 0)
            }
            onPress={() => void exportItems()}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity:
                  isLoading ||
                  (items.length === 0 &&
                    shoppingList.length === 0 &&
                    recentLocations.length === 0 &&
                    recentStores.length === 0)
                    ? 0.5
                    : pressed
                      ? 0.85
                      : 1,
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
            Import a full backup
          </Text>
          <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
            Paste a Home Stock backup. Items, buy-list entries, and saved places are merged; existing data is kept.
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
          {accountSignedIn
            ? 'Your stock is synced to this account and cached on this device. Export JSON for a portable backup.'
            : 'Guest stock is stored only on this device. Export JSON for a portable backup.'}
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
  syncStatus: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  textButton: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  privacyNote: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 12 },
});