import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { getLocalItem, setLocalItem } from './localStore';

const LAST_BACKUP_KEY = 'home-stock:last-backup:v1';

type BackupStatusValue = {
  lastBackupAt: number | null;
  // When the backup status was last read or changed; null until it has loaded.
  checkedAt: number | null;
  markBackedUp: () => void;
};

const BackupStatusContext = createContext<BackupStatusValue | null>(null);

export function BackupStatusProvider({ children }: { children: ReactNode }) {
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    getLocalItem(LAST_BACKUP_KEY)
      .catch(() => null)
      .then((saved) => {
        if (!isMounted) return;
        const savedAt = Number(saved);
        if (saved && Number.isFinite(savedAt)) {
          // A backup made while this was loading is newer, so keep it.
          setLastBackupAt((current) => current ?? savedAt);
        }
        setCheckedAt((current) => current ?? Date.now());
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Android can keep the app open for days, so refresh "now" when it comes back.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCheckedAt((current) => (current === null ? null : Date.now()));
      }
    });
    return () => subscription.remove();
  }, []);

  const markBackedUp = useCallback(() => {
    const now = Date.now();
    setLastBackupAt(now);
    setCheckedAt(now);
    void setLocalItem(LAST_BACKUP_KEY, String(now)).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ lastBackupAt, checkedAt, markBackedUp }),
    [lastBackupAt, checkedAt, markBackedUp],
  );

  return (
    <BackupStatusContext.Provider value={value}>{children}</BackupStatusContext.Provider>
  );
}

export function useBackupStatus() {
  const value = useContext(BackupStatusContext);
  if (!value) throw new Error('useBackupStatus must be used inside BackupStatusProvider.');
  return value;
}
