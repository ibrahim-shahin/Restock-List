import { nextAnswers, previousAnswers, shortItemIds } from '../stockCheck';

describe('stock check answers', () => {
  it('records answers until every item is answered', () => {
    expect(nextAnswers([], true, 2)).toEqual([true]);
    expect(nextAnswers([true], false, 2)).toEqual([true, false]);
    expect(nextAnswers([true, false], true, 2)).toEqual([true, false]);
  });

  it('steps back one answer at a time', () => {
    expect(previousAnswers([true, false])).toEqual([true]);
    expect(previousAnswers([])).toEqual([]);
  });

  it('lists the items that are short', () => {
    expect(shortItemIds(['milk', 'bread', 'rice'], [false, true, false])).toEqual(['milk', 'rice']);
    expect(shortItemIds(['milk', 'bread'], [false])).toEqual(['milk']);
  });
});
