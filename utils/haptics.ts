import * as Haptics from 'expo-haptics';

// Turned off from Settings > Vibration.
let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

/** A light tap, for answers and ticks. */
export function tapFeedback() {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function successFeedback() {
  if (enabled) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }
}

export function warningFeedback() {
  if (enabled) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }
}
