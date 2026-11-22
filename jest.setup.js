/* global jest */
// AsyncStorage has no native module under Jest; use the package's own mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The keyboard library has no native module under Jest either; use its own mock.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
