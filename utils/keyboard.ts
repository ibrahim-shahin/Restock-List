import { KeyboardController } from 'react-native-keyboard-controller';

// The longest wait for the keyboard to finish hiding; the screen closes anyway after it.
export const KEYBOARD_HIDE_WAIT_MS = 600;

/**
 * Hides the keyboard, then calls `close` once it has finished hiding, or
 * after KEYBOARD_HIDE_WAIT_MS at the latest. Closing a screen while the
 * keyboard is still animating away can crash the app on Android, so the two
 * animations never overlap. Without an open keyboard, `close` runs at once.
 */
export function closeAfterKeyboard(close: () => void): void {
  let isDone = false;
  const finish = () => {
    if (isDone) return;
    isDone = true;
    clearTimeout(fallback);
    close();
  };
  const fallback = setTimeout(finish, KEYBOARD_HIDE_WAIT_MS);
  KeyboardController.dismiss().then(finish, finish);
}
