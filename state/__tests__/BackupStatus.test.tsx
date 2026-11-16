import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { BackupStatusProvider, useBackupStatus } from '../BackupStatus';

const mockStorage = new Map<string, string>();
const mockReads = { delay: null as Promise<void> | null };

jest.mock('../localStore', () => ({
  getLocalItem: jest.fn(async (key: string) => {
    if (mockReads.delay) await mockReads.delay;
    return mockStorage.get(key) ?? null;
  }),
  setLocalItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
}));

const KEY = 'home-stock:last-backup:v1';

function Wrapper({ children }: { children: ReactNode }) {
  return <BackupStatusProvider>{children}</BackupStatusProvider>;
}

beforeEach(() => {
  mockStorage.clear();
  mockReads.delay = null;
});

it('starts with no backup and finishes loading', async () => {
  const { result } = await renderHook(() => useBackupStatus(), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.checkedAt).not.toBeNull());
  expect(result.current.lastBackupAt).toBeNull();
});

it('loads the saved backup time', async () => {
  mockStorage.set(KEY, '1700000000000');

  const { result } = await renderHook(() => useBackupStatus(), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.lastBackupAt).toBe(1700000000000));
});

it('saves the time of a new backup', async () => {
  const { result } = await renderHook(() => useBackupStatus(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.checkedAt).not.toBeNull());

  await act(() => {
    result.current.markBackedUp();
  });

  expect(result.current.lastBackupAt).toEqual(expect.any(Number));
  expect(mockStorage.get(KEY)).toBe(String(result.current.lastBackupAt));
});

it('keeps a backup made while the old time was still loading', async () => {
  mockStorage.set(KEY, '1');
  let finishRead = () => undefined as void;
  mockReads.delay = new Promise<void>((resolve) => {
    finishRead = resolve;
  });
  const { result } = await renderHook(() => useBackupStatus(), { wrapper: Wrapper });

  await act(() => {
    result.current.markBackedUp();
  });
  const backedUpAt = result.current.lastBackupAt;
  await act(async () => {
    finishRead();
    await Promise.resolve();
  });

  await waitFor(() => expect(result.current.checkedAt).not.toBeNull());
  expect(result.current.lastBackupAt).toBe(backedUpAt);
  expect(backedUpAt).not.toBe(1);
});

it('refreshes the clock when the app comes back to the foreground', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
  const { result } = await renderHook(() => useBackupStatus(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.checkedAt).not.toBeNull());
  const later = (result.current.checkedAt ?? 0) + 20 * 24 * 60 * 60 * 1000;
  jest.spyOn(Date, 'now').mockReturnValue(later);

  await act(() => {
    listeners.forEach((listener) => listener('active'));
  });

  expect(result.current.checkedAt).toBe(later);
  jest.restoreAllMocks();
});
