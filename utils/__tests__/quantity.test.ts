import { cleanQuantityInput } from '../quantity';

describe('cleanQuantityInput', () => {
  it('keeps plain digits', () => {
    expect(cleanQuantityInput('12')).toBe('12');
  });

  it('drops anything that is not a digit', () => {
    expect(cleanQuantityInput(' 1,5 kg')).toBe('15');
    expect(cleanQuantityInput('-3')).toBe('3');
    expect(cleanQuantityInput('1e22')).toBe('122');
  });

  it('turns Arabic-Indic and Persian digits into 0-9', () => {
    expect(cleanQuantityInput('٣٠')).toBe('30');
    expect(cleanQuantityInput('۱۲')).toBe('12');
  });

  it('allows at most four digits', () => {
    expect(cleanQuantityInput('123456')).toBe('1234');
  });
});
