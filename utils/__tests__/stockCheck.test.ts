import {
  nextAnswers,
  orderByPlace,
  placeProgress,
  previousAnswers,
  shortItemIds,
} from '../stockCheck';

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

describe('checking place by place', () => {
  const items = [
    { name: 'Yogurt', location: 'Fridge' },
    { name: 'soap', location: 'Bathroom' },
    { name: 'Rice', location: 'Pantry' },
    { name: 'Milk', location: 'fridge' },
    { name: 'Bleach', location: 'Bathroom' },
  ];

  it('groups items by place, ignoring case, with places and names in alphabetical order', () => {
    expect(orderByPlace(items).map((item) => item.name)).toEqual(['Bleach', 'soap', 'Milk', 'Yogurt', 'Rice']);
  });

  it('leaves the original list alone', () => {
    const copy = [...items];
    orderByPlace(items);
    expect(items).toEqual(copy);
  });

  it('reports how far through each place the check is', () => {
    const ordered = orderByPlace(items);
    expect(placeProgress(ordered, 0)).toEqual({ place: 'Bathroom', position: 1, count: 2, nextPlace: 'fridge' });
    expect(placeProgress(ordered, 1)).toEqual({ place: 'Bathroom', position: 2, count: 2, nextPlace: 'fridge' });
    expect(placeProgress(ordered, 3)).toEqual({ place: 'Fridge', position: 2, count: 2, nextPlace: 'Pantry' });
    expect(placeProgress(ordered, 4)).toEqual({ place: 'Pantry', position: 1, count: 1, nextPlace: null });
    expect(placeProgress(ordered, 5)).toBeNull();
  });
});
