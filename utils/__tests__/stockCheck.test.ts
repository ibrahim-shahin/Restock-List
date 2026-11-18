import {
  movePlace,
  nextAnswers,
  orderByPlace,
  orderPlaces,
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

describe('your route through the home', () => {
  const items = [
    { name: 'Rice', location: 'Pantry' },
    { name: 'Milk', location: 'Fridge' },
    { name: 'Soap', location: 'Bathroom' },
    { name: 'Eggs', location: 'fridge' },
    { name: 'Bulbs', location: 'Garage' },
  ];

  it('visits places in route order, then the rest A to Z', () => {
    expect(orderByPlace(items, ['Pantry', 'FRIDGE']).map((item) => item.name)).toEqual([
      'Rice', 'Eggs', 'Milk', 'Soap', 'Bulbs',
    ]);
  });

  it('lists each place once, in route order', () => {
    const places = items.map((item) => item.location);
    expect(orderPlaces(places)).toEqual(['Bathroom', 'Fridge', 'Garage', 'Pantry']);
    expect(orderPlaces(places, ['Garage', 'pantry'])).toEqual(['Garage', 'Pantry', 'Bathroom', 'Fridge']);
  });

  it('moves a place one step at a time and stops at the ends', () => {
    const order = ['Kitchen', 'Fridge', 'Pantry'];
    expect(movePlace(order, 0, 1)).toEqual(['Fridge', 'Kitchen', 'Pantry']);
    expect(movePlace(order, 2, -1)).toEqual(['Kitchen', 'Pantry', 'Fridge']);
    expect(movePlace(order, 0, -1)).toBe(order);
    expect(movePlace(order, 2, 1)).toBe(order);
  });
});

describe('places with the same name written differently', () => {
  const items = [
    { name: 'Tea', location: 'Café' },
    { name: 'Bread', location: 'Kitchen' },
    { name: 'Coffee', location: 'cafe' },
    { name: 'Rice', location: 'غرفة المؤونة' },
    { name: 'Oil', location: 'غرفه المؤونه' },
  ];

  it('treat them as one place, ignoring accents and Arabic spelling variants', () => {
    const ordered = orderByPlace(items);

    expect(ordered.map((item) => item.name)).toEqual(['Coffee', 'Tea', 'Bread', 'Oil', 'Rice']);
    expect(placeProgress(ordered, 0)).toMatchObject({ position: 1, count: 2 });
    expect(placeProgress(ordered, 3)).toMatchObject({ position: 1, count: 2, nextPlace: null });
    expect(orderPlaces(items.map((item) => item.location))).toHaveLength(3);
  });

  it('match the route the same way', () => {
    expect(orderByPlace(items, ['غرفة المؤونة', 'CAFE']).map((item) => item.name)).toEqual([
      'Oil', 'Rice', 'Coffee', 'Tea', 'Bread',
    ]);
  });
});
