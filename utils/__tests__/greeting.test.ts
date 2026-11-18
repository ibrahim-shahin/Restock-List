import { greetingFor } from '../greeting';

it('greets by the time of day', () => {
  expect(greetingFor(6)).toBe('Good morning');
  expect(greetingFor(11)).toBe('Good morning');
  expect(greetingFor(12)).toBe('Good afternoon');
  expect(greetingFor(16)).toBe('Good afternoon');
  expect(greetingFor(17)).toBe('Good evening');
  expect(greetingFor(23)).toBe('Good evening');
  expect(greetingFor(2)).toBe('Good evening');
});
