import * as Notifications from 'expo-notifications';
import {
  cancelWeeklyReminder,
  describeReminder,
  formatHour,
  isReminderTap,
  readReminderSettings,
  scheduleWeeklyReminder,
  showRemindersWhileOpen,
} from '../reminders';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('weekly-stock-check')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;
const saturdayAtTen = { enabled: true, weekday: 7, hour: 10 };

function permission(granted: boolean, canAskAgain = true) {
  return { granted, canAskAgain, status: granted ? 'granted' : 'denied', expires: 'never' } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scheduling the weekly reminder', () => {
  it('replaces any earlier reminder with a weekly one that opens the stock check', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(true));

    await expect(scheduleWeeklyReminder(saturdayAtTen, { askPermission: true })).resolves.toBe(true);

    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith('stock-check-reminders', expect.any(Object));
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-stock-check');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'weekly-stock-check',
      content: expect.objectContaining({ data: { url: '/stock-check' } }),
      trigger: { type: 'weekly', channelId: 'stock-check-reminders', weekday: 7, hour: 10, minute: 0 },
    });
  });

  it('asks for permission when allowed to, and schedules nothing if it is refused', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false));
    mocked.requestPermissionsAsync.mockResolvedValue(permission(false));

    await expect(scheduleWeeklyReminder(saturdayAtTen, { askPermission: true })).resolves.toBe(false);

    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('never asks when it is only restoring the reminder', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false));

    await expect(scheduleWeeklyReminder(saturdayAtTen, { askPermission: false })).resolves.toBe(false);

    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("doesn't ask again once Android has stopped showing the prompt", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, false));

    await expect(scheduleWeeklyReminder(saturdayAtTen, { askPermission: true })).resolves.toBe(false);

    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('cancels the reminder', async () => {
    await cancelWeeklyReminder();

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-stock-check');
  });
});

describe('reminder settings', () => {
  it('describes the reminder', () => {
    expect(describeReminder({ ...saturdayAtTen, enabled: false })).toMatch(/^Off/);
    expect(describeReminder(saturdayAtTen)).toMatch(/^Every Saturday at 10[:.]00/);
    expect(formatHour(18)).toMatch(/^(6[:.]00\sPM|18[:.]00)$/);
  });

  it('reads saved settings and falls back to the defaults', () => {
    expect(readReminderSettings(JSON.stringify(saturdayAtTen))).toEqual(saturdayAtTen);
    expect(readReminderSettings(null)).toEqual({ enabled: false, weekday: 7, hour: 10 });
    expect(readReminderSettings('not json')).toEqual({ enabled: false, weekday: 7, hour: 10 });
    expect(readReminderSettings(JSON.stringify({ enabled: true, weekday: 9, hour: 10 }))).toEqual({
      enabled: false,
      weekday: 7,
      hour: 10,
    });
  });

  it('recognises a tap on the reminder', () => {
    const tap = (url: unknown) =>
      ({ notification: { request: { content: { data: { url } } } } }) as never;
    expect(isReminderTap(tap('/stock-check'))).toBe(true);
    expect(isReminderTap(tap('/somewhere-else'))).toBe(false);
    expect(isReminderTap(null)).toBe(false);
  });
});

it('shows the reminder while the app is open, without sound or badge', async () => {
  showRemindersWhileOpen();

  const handler = mocked.setNotificationHandler.mock.calls[0][0];
  await expect(handler?.handleNotification({} as never)).resolves.toEqual({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  });
});
