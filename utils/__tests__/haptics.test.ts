import * as Haptics from 'expo-haptics';
import { setHapticsEnabled, successFeedback, tapFeedback, warningFeedback } from '../haptics';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  setHapticsEnabled(true);
});

it('vibrates while vibration is on', () => {
  tapFeedback();
  successFeedback();
  warningFeedback();

  expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
});

it('stays still once vibration is turned off', () => {
  setHapticsEnabled(false);

  tapFeedback();
  successFeedback();
  warningFeedback();

  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});
