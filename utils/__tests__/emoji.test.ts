import { DEFAULT_EMOJI, EMOJI_CHOICES, itemEmoji, suggestEmoji } from '../emoji';

describe('suggestEmoji', () => {
  it.each([
    ['Milk', '🥛'],
    ['Whole milk', '🥛'],
    ['Eggs', '🥚'],
    ['AA Batteries', '🔋'],
    ['Toilet paper', '🧻'],
    ['Toothpaste', '🪥'],
    ['Dish soap', '🧽'],
    ['Hand soap', '🧼'],
    ['Olive oil', '🫒'],
    ['Basmati rice', '🍚'],
    ['Cat litter', '🐾'],
    ['Birthday candles', '🕯️'],
  ])('%s gets %s', (name, emoji) => {
    expect(suggestEmoji(name)).toBe(emoji);
  });

  it.each([
    ['حليب', '🥛'],
    ['الحليب', '🥛'],
    ['بيض بلدي', '🥚'],
    ['أرز بسمتي', '🍚'],
    ['خبز عربي', '🍞'],
    ['جبنة بيضاء', '🧀'],
    ['قهوة', '☕'],
    ['شاي', '🍵'],
    ['معجون أسنان', '🪥'],
    ['ورق تواليت', '🧻'],
    ['شامبو', '🧴'],
  ])('Arabic %s gets %s', (name, emoji) => {
    expect(suggestEmoji(name)).toBe(emoji);
  });

  it('matches whole Arabic words, with or without a prefix', () => {
    expect(suggestEmoji('جبنة بيضاء')).toBe('🧀');
    expect(suggestEmoji('بيضة')).toBe('🥚');
    expect(suggestEmoji('والبيض')).toBe('🥚');
    expect(suggestEmoji('ملح البحر')).toBe('🧂');
  });

  it('tells food creams, pastes and peppers apart from the general words', () => {
    expect(suggestEmoji('Ice cream')).toBe('🍦');
    expect(suggestEmoji('آيس كريم')).toBe('🍦');
    expect(suggestEmoji('Cream cheese')).toBe('🧀');
    expect(suggestEmoji('Sour cream')).toBe('🧀');
    expect(suggestEmoji('Hand cream')).toBe('🧴');
    expect(suggestEmoji('Tomato paste')).toBe('🥫');
    expect(suggestEmoji('معجون طماطم')).toBe('🥫');
    expect(suggestEmoji('Tomatoes')).toBe('🍅');
    expect(suggestEmoji('Bell peppers')).toBe('🫑');
    expect(suggestEmoji('Black pepper')).toBe('🧂');
    expect(suggestEmoji('حبوب الإفطار')).toBe('🥣');
    expect(suggestEmoji('حبوب بنادول')).toBe('💊');
  });

  it('matches Arabic feminine and plural endings', () => {
    expect(suggestEmoji('شمعة')).toBe('🕯️');
    expect(suggestEmoji('شموع')).toBe('🕯️');
    expect(suggestEmoji('حفاضات')).toBe('👶');
    expect(suggestEmoji('لحمة')).toBe('🥩');
    expect(suggestEmoji('تفاحة')).toBe('🍎');
    expect(suggestEmoji('مياه')).toBe('💧');
  });

  it('gives the same answer every time for the same name', () => {
    expect(suggestEmoji('Milk')).toBe(suggestEmoji('Milk'));
  });

  it('matches whole English words only', () => {
    expect(suggestEmoji('Candles')).not.toBe('🥫');
    expect(suggestEmoji('Scandinavian rug')).toBe(DEFAULT_EMOJI);
  });

  it('falls back to a box', () => {
    expect(suggestEmoji('Gift wrap')).toBe(DEFAULT_EMOJI);
    expect(suggestEmoji('')).toBe(DEFAULT_EMOJI);
  });
});

describe('itemEmoji', () => {
  it('prefers the emoji you chose', () => {
    expect(itemEmoji({ name: 'Milk', emoji: '🧃' })).toBe('🧃');
    expect(itemEmoji({ name: 'Milk', emoji: '' })).toBe('🥛');
    expect(itemEmoji({ name: 'Milk' })).toBe('🥛');
  });
});

it('offers each emoji once, including the default', () => {
  expect(new Set(EMOJI_CHOICES).size).toBe(EMOJI_CHOICES.length);
  expect(EMOJI_CHOICES).toContain(DEFAULT_EMOJI);
});
