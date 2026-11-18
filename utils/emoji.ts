import { normalizeForSearch } from '@/utils/search';

export const DEFAULT_EMOJI = '📦';

// Checked in order, so more specific words come before general ones
// ("toothpaste" before "paste", "toilet paper" before "paper").
// Keywords match whole words: English plurals count ("eggs"), and so do
// Arabic words with a prefix ("الحليب"), but "بيضاء" (white) isn't "بيض".
const EMOJI_KEYWORDS: [string, string[]][] = [
  // Phrases that contain a more general word matched further down.
  ['🍦', ['ice cream', 'gelato', 'بوظه', 'ايس كريم']],
  ['🧀', ['cream cheese', 'sour cream', 'cooking cream', 'whipping cream', 'قشطه', 'كريمه طبخ']],
  ['🥫', ['tomato paste', 'tomato puree', 'معجون طماطم', 'معجون بندوره', 'رب بندوره', 'رب البندوره']],
  ['🫑', ['bell pepper', 'capsicum', 'فليفله', 'فلفل حلو', 'فلفل رومي']],
  ['🥣', ['breakfast cereal', 'حبوب الافطار', 'حبوب افطار']],
  ['🧻', ['toilet paper', 'toilet roll', 'tissue', 'napkin', 'paper towel', 'kitchen roll', 'ورق تواليت', 'محارم', 'مناديل', 'كلينكس']],
  ['🪥', ['toothpaste', 'toothbrush', 'floss', 'mouthwash', 'معجون اسنان', 'فرشاه اسنان', 'فرشاة اسنان']],
  ['🧽', ['dish soap', 'dishwashing', 'washing up', 'dishwasher', 'sponge', 'جلي', 'اسفنج', 'ليفه']],
  ['🧺', ['laundry', 'detergent', 'fabric softener', 'washing powder', 'softener', 'غسيل', 'منعم']],
  ['🧹', ['bleach', 'cleaner', 'cleaning', 'disinfectant', 'floor', 'كلور', 'منظف', 'تنظيف', 'معطر']],
  ['🗑️', ['trash', 'garbage', 'bin bag', 'rubbish', 'زباله', 'نفايات']],
  ['🧼', ['soap', 'hand wash', 'handwash', 'sanitiser', 'sanitizer', 'صابون', 'معقم']],
  ['🧴', ['shampoo', 'conditioner', 'lotion', 'shower gel', 'body wash', 'cream', 'deodorant', 'شامبو', 'بلسم', 'لوشن', 'كريم', 'مزيل عرق']],
  ['🪒', ['razor', 'shaving', 'شفرات', 'حلاقه']],
  ['💊', ['medicine', 'pill', 'tablet', 'vitamin', 'painkiller', 'paracetamol', 'panadol', 'دواء', 'حبوب', 'فيتامين', 'بنادول']],
  ['🩹', ['plaster', 'bandage', 'band aid', 'لاصق جروح', 'شاش']],
  ['👶', ['diaper', 'nappy', 'nappies', 'baby wipe', 'wipe', 'حفاض', 'فاين', 'بامبرز', 'محارم مبلله']],
  ['🐾', ['cat food', 'dog food', 'pet food', 'cat litter', 'litter', 'اكل قطط', 'اكل كلاب', 'رمل قطط']],
  ['🔋', ['battery', 'batteries', 'بطاريه', 'بطاريات']],
  ['💡', ['light bulb', 'bulb', 'لمبه', 'لمبات']],
  ['🕯️', ['candle', 'شمع', 'شموع']],
  ['🥛', ['milk', 'حليب']],
  ['🥣', ['yogurt', 'yoghurt', 'labneh', 'cereal', 'oats', 'cornflakes', 'لبنه', 'لبن', 'زبادي', 'شوفان', 'كورن فليكس']],
  ['🥚', ['egg', 'بيض', 'بيضه']],
  ['🧀', ['cheese', 'halloumi', 'جبنه', 'جبن']],
  ['🧈', ['butter', 'ghee', 'margarine', 'زبده', 'سمنه']],
  ['🍞', ['bread', 'loaf', 'toast', 'pita', 'خبز', 'عيش', 'صمون']],
  ['🍚', ['rice', 'ارز', 'رز']],
  ['🍝', ['pasta', 'spaghetti', 'macaroni', 'noodle', 'معكرونه', 'مكرونه', 'شعيريه']],
  ['🌾', ['flour', 'yeast', 'bulgur', 'طحين', 'خميره', 'برغل']],
  ['🫒', ['olive', 'oil', 'زيتون', 'زيت']],
  ['🧂', ['salt', 'pepper', 'spice', 'cumin', 'ملح', 'بهار', 'فلفل', 'كمون']],
  ['🍯', ['honey', 'jam', 'tahini', 'عسل', 'مربى', 'طحينه']],
  ['🍬', ['sugar', 'sweetener', 'سكر']],
  ['☕', ['coffee', 'nescafe', 'espresso', 'قهوه', 'نسكافيه']],
  ['🍵', ['tea', 'شاي']],
  ['🧃', ['juice', 'عصير']],
  ['🥤', ['soda', 'cola', 'soft drink', 'fizzy', 'كولا', 'بيبسي', 'مشروب غازي']],
  ['💧', ['water', 'مياه', 'ماء']],
  ['🧊', ['ice', 'frozen', 'ثلج', 'مجمد']],
  ['🍫', ['chocolate', 'شوكولاته', 'شوكولا']],
  ['🍪', ['biscuit', 'cookie', 'snack', 'crisps', 'chips', 'cracker', 'بسكويت', 'شيبس', 'كعك']],
  ['🥜', ['nut', 'peanut', 'almond', 'cashew', 'pistachio', 'مكسرات', 'لوز', 'فستق', 'كاجو']],
  ['🍋', ['lemon', 'lime', 'ليمون']],
  ['🍊', ['orange', 'mandarin', 'برتقال', 'يوسفي']],
  ['🍌', ['banana', 'موز']],
  ['🍎', ['apple', 'fruit', 'تفاح', 'فواكه']],
  ['🍅', ['tomato', 'ketchup', 'بندوره', 'طماطم', 'كاتشب']],
  ['🥔', ['potato', 'بطاطا', 'بطاطس']],
  ['🧅', ['onion', 'بصل']],
  ['🧄', ['garlic', 'ثوم']],
  ['🥒', ['cucumber', 'pickle', 'خيار', 'مخلل']],
  ['🌿', ['mint', 'parsley', 'herb', 'coriander', 'نعنع', 'بقدونس', 'كزبره']],
  ['🥬', ['lettuce', 'spinach', 'cabbage', 'vegetable', 'veg', 'greens', 'خس', 'سبانخ', 'ملفوف', 'خضار']],
  ['🍗', ['chicken', 'دجاج', 'جاج']],
  ['🥩', ['meat', 'beef', 'lamb', 'steak', 'mince', 'لحم']],
  ['🐟', ['fish', 'tuna', 'salmon', 'sardine', 'سمك', 'تونه', 'سردين']],
  ['🥫', ['can', 'canned', 'beans', 'chickpea', 'hummus', 'soup', 'معلبات', 'فول', 'حمص', 'معجون']],
];

const ARABIC = /[\u0600-\u06ff]/;

// Words of an already normalized name: Latin letters, digits and Arabic.
function words(text: string): string[] {
  return text.split(/[^a-z0-9\u0600-\u06ff]+/).filter(Boolean);
}

// An Arabic word, and the same word without "ال" (and the prefixes that come
// with it) or without the endings of feminine and plural forms: ة (written
// ه after normalizing) and ات, so "شمعة" and "حفاضات" find "شمع" and "حفاض".
function arabicForms(word: string): string[] {
  const stems = [word];
  for (const prefix of ['وال', 'بال', 'فال', 'كال', 'لل', 'ال']) {
    if (word.startsWith(prefix) && word.length - prefix.length >= 2) {
      stems.push(word.slice(prefix.length));
    }
  }
  const forms = [...stems];
  for (const stem of stems) {
    for (const ending of ['ات', 'ه']) {
      if (stem.endsWith(ending) && stem.length - ending.length >= 2) {
        forms.push(stem.slice(0, -ending.length));
      }
    }
  }
  return forms;
}

// "eggs" and "batteries" count as "egg" and "battery".
function sameWord(word: string, keyword: string): boolean {
  return (
    word === keyword ||
    word === `${keyword}s` ||
    word === `${keyword}es` ||
    (keyword.endsWith('y') && word === `${keyword.slice(0, -1)}ies`)
  );
}

type Keyword = { arabic: boolean; parts: string[] };

// Normalized once, when the app starts.
const KEYWORDS: [string, Keyword[]][] = EMOJI_KEYWORDS.map(([emoji, keywords]) => [
  emoji,
  keywords.map((keyword) => ({
    arabic: ARABIC.test(keyword),
    parts: words(normalizeForSearch(keyword)),
  })),
]);

function matches(nameWords: string[], keyword: Keyword): boolean {
  const same = keyword.arabic
    ? (word: string, part: string) => arabicForms(word).includes(part)
    : sameWord;
  return nameWords.some((_, start) =>
    keyword.parts.every((part, offset) => {
      const word = nameWords[start + offset];
      return word !== undefined && same(word, part);
    }),
  );
}

// Names are looked up on every render of a list, so results are remembered.
const suggestions = new Map<string, string>();
const MAX_REMEMBERED = 500;

/** An emoji that fits the item's name, or a box when nothing fits. */
export function suggestEmoji(name: string): string {
  const remembered = suggestions.get(name);
  if (remembered) return remembered;
  const nameWords = words(normalizeForSearch(name));
  const match = KEYWORDS.find(([, keywords]) =>
    keywords.some((keyword) => matches(nameWords, keyword)),
  );
  const emoji = match ? match[0] : DEFAULT_EMOJI;
  if (suggestions.size >= MAX_REMEMBERED) suggestions.clear();
  suggestions.set(name, emoji);
  return emoji;
}

/** The emoji chosen for the item, or one picked from its name. */
export function itemEmoji(item: { name: string; emoji?: string }): string {
  return item.emoji || suggestEmoji(item.name);
}

/** Emoji to pick from in the item form. */
export const EMOJI_CHOICES = [
  '🥛', '🥚', '🍞', '🧀', '🧈', '🥣', '🍚', '🍝', '🌾', '🫒', '🧂', '🍯',
  '🍬', '☕', '🍵', '🧃', '🥤', '💧', '🧊', '🍦', '🍫', '🍪', '🥜', '🍋', '🍊',
  '🍌', '🍎', '🍅', '🫑', '🥔', '🧅', '🧄', '🥒', '🥬', '🌿', '🍗', '🥩', '🐟',
  '🥫', '🧻', '🧼', '🧽', '🧺', '🧹', '🗑️', '🪥', '🧴', '🪒', '💊', '🩹',
  '👶', '🐾', '🔋', '💡', '🕯️', '📦',
];
