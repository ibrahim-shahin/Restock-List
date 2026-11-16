import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_NAME = 'home-stock.db';
const TABLE_NAME = 'home_stock_local_state';

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0
        );
      `);
      return database;
    }).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function removeLegacyValue(key: string): Promise<void> {
  return AsyncStorage.removeItem(key).catch(() => undefined);
}

export async function getLocalItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);

  const database = await getDatabase();
  const saved = await database.getFirstAsync<{
    value: string;
    is_deleted: number;
  }>(`SELECT value, is_deleted FROM ${TABLE_NAME} WHERE key = ?`, key);

  if (saved) {
    await removeLegacyValue(key);
    return saved.is_deleted === 1 ? null : saved.value;
  }

  const legacyValue = await AsyncStorage.getItem(key);
  if (legacyValue === null) return null;

  await database.runAsync(
    `INSERT INTO ${TABLE_NAME} (key, value, is_deleted)
     VALUES (?, ?, 0)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_deleted = 0`,
    key,
    legacyValue,
  );
  await removeLegacyValue(key);
  return legacyValue;
}

export async function setLocalItem(
  key: string,
  value: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO ${TABLE_NAME} (key, value, is_deleted)
     VALUES (?, ?, 0)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_deleted = 0`,
    key,
    value,
  );
  await removeLegacyValue(key);
}
