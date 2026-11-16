import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SavedData } from '@/state/StockContext';

const DAY_MS = 24 * 60 * 60 * 1000;
// The Stock screen reminds you to back up once the last backup is this old.
export const BACKUP_REMINDER_DAYS = 14;
// A large household inventory is well under 1 MB, so anything bigger is not a backup.
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export type PickedBackup = { canceled: true } | { canceled: false; data: unknown };

export function hasStockData(data: SavedData): boolean {
  return (
    data.items.length > 0 ||
    data.shoppingList.length > 0 ||
    data.recentLocations.length > 0 ||
    data.recentStores.length > 0
  );
}

export function createBackup(data: SavedData, now = new Date()) {
  return {
    format: 'home-stock-backup',
    version: 3,
    exportedAt: now.toISOString(),
    items: data.items,
    shoppingList: data.shoppingList,
    recentLocations: data.recentLocations,
    recentStores: data.recentStores,
  };
}

export function backupFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `home-stock-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Writes text to a file and opens the share sheet, so it can go to Drive, Files or a chat. */
export async function shareTextFile(name: string, text: string, dialogTitle: string): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, {
    dialogTitle,
    mimeType: 'application/json',
    UTI: 'public.json',
  });
}

export function shareBackupFile(data: SavedData, now = new Date()): Promise<void> {
  return shareTextFile(
    backupFileName(now),
    JSON.stringify(createBackup(data, now), null, 2),
    'Save your Home Stock backup',
  );
}

/** Asks for a backup file and returns its parsed contents. */
export async function pickBackupFile(): Promise<PickedBackup> {
  // Any file type: Drive and chat apps often save JSON without a JSON file type.
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return { canceled: true };
  if (picked.result.size > MAX_BACKUP_BYTES) {
    throw new Error('This file is too large to be a Home Stock backup.');
  }
  const text = await picked.result.text();
  try {
    return { canceled: false, data: JSON.parse(text) as unknown };
  } catch {
    throw new Error('This file is not a Home Stock backup.');
  }
}

/** A reminder when there is stock that hasn't been backed up recently, otherwise null. */
export function backupReminder(
  lastBackupAt: number | null,
  hasItems: boolean,
  now: number,
): string | null {
  if (!hasItems) return null;
  if (lastBackupAt === null) return "You haven't backed up your stock yet.";
  const days = Math.floor((now - lastBackupAt) / DAY_MS);
  return days >= BACKUP_REMINDER_DAYS ? `Your last backup was ${days} days ago.` : null;
}

export function describeLastBackup(lastBackupAt: number | null, now: number): string {
  if (lastBackupAt === null) return 'No backup yet';
  const days = Math.floor((now - lastBackupAt) / DAY_MS);
  if (days < 1) return 'Last backup: today';
  if (days === 1) return 'Last backup: yesterday';
  return `Last backup: ${days} days ago`;
}
