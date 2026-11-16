import { act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useReminderTaps } from '../useReminderTaps';

const mockPath = { current: '/' };
const mockTapListeners: ((response: unknown) => void)[] = [];

jest.mock('expo-notifications', () => ({
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((listener: (response: unknown) => void) => {
    mockTapListeners.push(listener);
    return { remove: () => mockTapListeners.splice(mockTapListeners.indexOf(listener), 1) };
  }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  usePathname: () => mockPath.current,
}));

const getLast = Notifications.getLastNotificationResponse as jest.Mock;

function tap(url: string) {
  return { notification: { request: { content: { data: { url } } } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTapListeners.length = 0;
  mockPath.current = '/';
});

it('opens the stock check when the reminder started the app', async () => {
  getLast.mockReturnValueOnce(tap('/stock-check'));

  await renderHook(() => useReminderTaps());

  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith('/stock-check');
  expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
});

it('does nothing on a normal launch', async () => {
  await renderHook(() => useReminderTaps());

  expect(router.push).not.toHaveBeenCalled();
});

it('opens the stock check when the reminder is tapped while the app is open', async () => {
  await renderHook(() => useReminderTaps());

  await act(() => {
    mockTapListeners.forEach((listener) => listener(tap('/stock-check')));
  });

  expect(router.push).toHaveBeenCalledWith('/stock-check');
});

it("doesn't open a second check on top of one that is already open", async () => {
  mockPath.current = '/stock-check';
  await renderHook(() => useReminderTaps());

  await act(() => {
    mockTapListeners.forEach((listener) => listener(tap('/stock-check')));
  });

  expect(router.push).not.toHaveBeenCalled();
});

it('ignores other notifications', async () => {
  await renderHook(() => useReminderTaps());

  await act(() => {
    mockTapListeners.forEach((listener) => listener(tap('/somewhere-else')));
  });

  expect(router.push).not.toHaveBeenCalled();
});

it('stops listening when unmounted', async () => {
  const { unmount } = await renderHook(() => useReminderTaps());

  await unmount();

  expect(mockTapListeners).toHaveLength(0);
});
