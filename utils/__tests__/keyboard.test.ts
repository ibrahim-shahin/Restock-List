import { KeyboardController } from 'react-native-keyboard-controller';
import { closeAfterKeyboard, KEYBOARD_HIDE_WAIT_MS } from '../keyboard';

const dismiss = jest.mocked(KeyboardController.dismiss);

// Lets the test decide when the keyboard finishes hiding.
function keyboardHidesLater() {
  let hidden: () => void = () => undefined;
  dismiss.mockImplementationOnce(() => new Promise<void>((resolve) => (hidden = resolve)));
  return () => hidden();
}

beforeEach(() => {
  jest.useFakeTimers();
  dismiss.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

it('closes the screen only after the keyboard has finished hiding', async () => {
  const finishHiding = keyboardHidesLater();
  const close = jest.fn();

  closeAfterKeyboard(close);
  await jest.advanceTimersByTimeAsync(KEYBOARD_HIDE_WAIT_MS / 2);
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();

  finishHiding();
  await jest.advanceTimersByTimeAsync(0);
  expect(close).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(KEYBOARD_HIDE_WAIT_MS);
  expect(close).toHaveBeenCalledTimes(1);
});

it('closes anyway when the keyboard never says it has hidden', async () => {
  const finishHiding = keyboardHidesLater();
  const close = jest.fn();

  closeAfterKeyboard(close);
  await jest.advanceTimersByTimeAsync(KEYBOARD_HIDE_WAIT_MS);
  expect(close).toHaveBeenCalledTimes(1);

  finishHiding();
  await jest.advanceTimersByTimeAsync(0);
  expect(close).toHaveBeenCalledTimes(1);
});

it('closes at once when no keyboard is open, and when hiding fails', async () => {
  const close = jest.fn();
  closeAfterKeyboard(close);
  await jest.advanceTimersByTimeAsync(0);
  expect(close).toHaveBeenCalledTimes(1);

  dismiss.mockImplementationOnce(() => Promise.reject(new Error('no keyboard')));
  closeAfterKeyboard(close);
  await jest.advanceTimersByTimeAsync(0);
  expect(close).toHaveBeenCalledTimes(2);
});
