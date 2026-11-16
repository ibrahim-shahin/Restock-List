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
import { useBackupStatus } from '@/state/BackupStatus';
import { useStock } from '@/state/StockContext';
import {
  createBackup,
  describeLastBackup,
  hasStockData,
  pickBackupFile,
  shareBackupFile,
  shareTextFile,
} from '@/utils/backup';
import { router } from 'expo-router';

type ImportResult = {
  importedCount: number;
  skippedCount: number;
  shoppingListAddedCount: number;
};

function importSummary(result: ImportResult): string {
  const summary = `${result.importedCount} ${result.importedCount === 1 ? 'item was' : 'items were'} added.`;
  const skipped = result.skippedCount
    ? ` ${result.skippedCount} duplicate ${result.skippedCount === 1 ? 'item was' : 'items were'} skipped.`
    : '';
  const listSummary = result.shoppingListAddedCount
    ? ` ${result.shoppingListAddedCount} buy-list ${result.shoppingListAddedCount === 1 ? 'entry was' : 'entries were'} added.`
    : '';
  return `${summary}${listSummary}${skipped} Your existing data was kept.`;
}

function importErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return 'This text is not a complete backup. Paste all of it, from the first { to the last }.';
  }
  return error instanceof Error
    ? error.message
    : 'This backup could not be imported. Check that it came from a Home Stock export.';
}

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
    loadProblem,
    loadNotice,
    dismissLoadNotice,
    retryLoad,
    startFresh,
    savedCopyCount,
    getRecoveryData,
    deleteSavedCopies,
  } = useStock();
  const { lastBackupAt, checkedAt, markBackedUp } = useBackupStatus();
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const stockData = { items, shoppingList, recentLocations, recentStores };
  const canExport = !isLoading && !isBusy && hasStockData(stockData);

  // Android doesn't report whether a share finished, so ask before recording it.
  function confirmBackupSaved() {
    Alert.alert(
      'Did the backup save?',
      "Android doesn't tell Home Stock whether sharing finished. Tap Yes once the backup is saved, so the backup reminder stays accurate.",
      [
        { text: 'Not yet', style: 'cancel' },
        { text: "Yes, it's saved", onPress: markBackedUp },
      ],
    );
  }

  async function saveBackupFile() {
    setIsBusy(true);
    try {
      await shareBackupFile(stockData);
    } catch {
      Alert.alert('Could not save the backup', 'Please try again.');
      return;
    } finally {
      setIsBusy(false);
    }
    confirmBackupSaved();
  }

  async function shareBackupText() {
    try {
      const result = await Share.share({
        title: 'Home Stock backup',
        message: JSON.stringify(createBackup(stockData), null, 2),
      });
      if (result.action === Share.dismissedAction) return;
    } catch {
      Alert.alert('Could not export', 'Please try sharing your inventory again.');
      return;
    }
    confirmBackupSaved();
  }

  async function importBackupFile() {
    setError('');
    setIsBusy(true);
    try {
      const picked = await pickBackupFile();
      if (!picked.canceled) {
        Alert.alert('Import complete', importSummary(importBackup(picked.data)));
      }
    } catch (importError) {
      setError(importErrorMessage(importError));
    } finally {
      setIsBusy(false);
    }
  }

  async function saveOriginalCopy() {
    setIsBusy(true);
    try {
      const data = await getRecoveryData();
      if (data === null) {
        Alert.alert('Nothing to save', 'No copy of the original data was found.');
        return;
      }
      await shareTextFile(
        loadProblem === 'unreadable'
          ? 'home-stock-unreadable-data.json'
          : 'home-stock-saved-copies.json',
        data,
        'Save a copy of your original Home Stock data',
      );
    } catch {
      Alert.alert('Could not save the copy', 'Please try again.');
    } finally {
      setIsBusy(false);
    }
  }

  function confirmStartFresh() {
    Alert.alert(
      'Start fresh?',
      'Your stock list starts empty. A copy of the unreadable data stays on this phone, and you can open a backup file next.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start fresh',
          style: 'destructive',
          onPress: () => {
            startFresh().catch(() => {
              Alert.alert('Could not start fresh', 'Please try again.');
            });
          },
        },
      ],
    );
  }

  function confirmDeleteCopies() {
    Alert.alert(
      'Delete the saved copies?',
      'They hold saved stock that could not be read. Save a copy first if you might want it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSavedCopies().catch(() => {
              Alert.alert('Could not delete the copies', 'Please try again.');
            });
          },
        },
      ],
    );
  }

  function importPastedText() {
    if (!jsonText.trim()) {
      setError('Paste your exported JSON above first.');
      return;
    }
    try {
      const result = importBackup(JSON.parse(jsonText) as unknown);
      setJsonText('');
      setError('');
      Alert.alert('Import complete', importSummary(result));
    } catch (importError) {
      setError(importErrorMessage(importError));
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
            Your stock is saved on this phone. Save a backup file now and then so you can restore it on a new phone.
          </Text>
          {checkedAt !== null ? (
            <Text style={[styles.lastBackup, { color: colors.primary }]} testID="last-backup">
              {describeLastBackup(lastBackupAt, checkedAt)}
            </Text>
          ) : null}
        </View>

        {loadProblem || loadNotice || savedCopyCount > 0 ? (
          <View
            style={[styles.card, styles.recoveryCard, { backgroundColor: colors.card, borderColor: colors.destructive }]}
            testID="recovery-card"
          >
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {loadProblem === 'read-failed'
                ? "Your saved stock couldn't be read"
                : loadProblem === 'unreadable'
                  ? "Your saved stock couldn't be opened"
                  : loadNotice
                    ? 'Some saved items were left out'
                    : 'Damaged saved data is kept on this phone'}
            </Text>
            <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
              {loadProblem === 'read-failed'
                ? 'This is usually temporary. Try again, or close and reopen the app.'
                : loadProblem === 'unreadable'
                  ? 'Save a copy of it to keep it safe, then start fresh and open your latest backup file.'
                  : (loadNotice ??
                    `${savedCopyCount} ${savedCopyCount === 1 ? 'copy' : 'copies'} of saved stock that could not be read. Save a copy to keep it, or delete it.`)}
            </Text>
            {loadProblem === 'read-failed' ? (
              <Pressable
                accessibilityRole="button"
                onPress={retryLoad}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
                testID="retry-load-button"
              >
                <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                  Try again
                </Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => void saveOriginalCopy()}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { backgroundColor: colors.secondary, opacity: isBusy ? 0.5 : pressed ? 0.8 : 1 },
                  ]}
                  testID="save-original-button"
                >
                  <Feather name="save" size={16} color={colors.primary} />
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                    Save a copy
                  </Text>
                </Pressable>
                {loadProblem === 'unreadable' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={confirmStartFresh}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: colors.destructive, opacity: pressed ? 0.85 : 1 },
                    ]}
                    testID="start-fresh-button"
                  >
                    <Feather name="rotate-ccw" size={16} color={colors.destructiveForeground} />
                    <Text style={[styles.primaryButtonText, { color: colors.destructiveForeground }]}>
                      Start fresh
                    </Text>
                  </Pressable>
                ) : loadNotice ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={dismissLoadNotice}
                    style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.65 : 1 }]}
                    testID="dismiss-notice-button"
                  >
                    <Text style={[styles.textButtonText, { color: colors.mutedForeground }]}>
                      Dismiss
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={confirmDeleteCopies}
                    style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.65 : 1 }]}
                    testID="delete-copies-button"
                  >
                    <Text style={[styles.textButtonText, { color: colors.destructive }]}>
                      Delete the copies
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Export a full backup
          </Text>
          <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
            Save {items.length} {items.length === 1 ? 'item' : 'items'}, your buy list, and saved places as a file you can keep in Google Drive, Files or a chat.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!canExport}
            onPress={() => void saveBackupFile()}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: !canExport ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
            testID="export-file-button"
          >
            <Feather name="save" size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              Save backup file
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canExport}
            onPress={() => void shareBackupText()}
            style={({ pressed }) => [
              styles.textButton,
              { opacity: !canExport ? 0.5 : pressed ? 0.65 : 1 },
            ]}
            testID="export-items-button"
          >
            <Text style={[styles.textButtonText, { color: colors.primary }]}>
              Share as text instead
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Import a full backup
          </Text>
          <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
            Open a Home Stock backup file, or paste its text below. Items, buy-list entries, and saved places are merged; existing data is kept.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading || isBusy}
            onPress={() => void importBackupFile()}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: isLoading || isBusy ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
            testID="import-file-button"
          >
            <Feather name="folder" size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              Open backup file
            </Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Paste inventory JSON"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={(text) => {
              setJsonText(text);
              if (error) setError('');
            }}
            placeholder={'Or paste backup text here, for example:\n{"items":[...]} '}
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
            disabled={isLoading || isBusy || !jsonText.trim()}
            onPress={importPastedText}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: colors.secondary,
                opacity: isLoading || isBusy || !jsonText.trim() ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
            testID="import-json-button"
          >
            <Feather name="download" size={16} color={colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Import pasted text
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
          {"Home Stock doesn't send your stock anywhere. Keep your backup file somewhere safe, like Google Drive."}
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
  lastBackup: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  card: { borderRadius: 19, padding: 16, gap: 11 },
  recoveryCard: { borderWidth: 1 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  cardCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  primaryButton: { minHeight: 47, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  jsonInput: { minHeight: 165, maxHeight: 300, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  secondaryButton: { minHeight: 47, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  textButton: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  privacyNote: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 12 },
});