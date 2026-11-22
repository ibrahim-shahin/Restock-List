import { groupStockItems } from '../stockGroups';

const item = (name: string, location: string, storeTypes: string[]) => ({ name, location, storeTypes });
const milk = item('Milk', 'Fridge', ['Supermarket']);
const rice = item('Rice', 'Pantry', ['Market', 'Supermarket']);
const yogurt = item('Yogurt', 'fridge', ['supermarket']);
const soap = item('Soap', 'Bathroom', ['Pharmacy']);
const items = [milk, rice, yogurt, soap];

const summary = (groups: ReturnType<typeof groupStockItems<typeof milk>>) =>
  groups.map((group) => [group.title, group.items.map((entry) => entry.name)]);

it('groups by storage place, A to Z, treating different cases as one place', () => {
  expect(summary(groupStockItems(items, 'place'))).toEqual([
    ['Bathroom', ['Soap']],
    ['Fridge', ['Milk', 'Yogurt']],
    ['Pantry', ['Rice']],
  ]);
});

it('puts places in the order of your stock-check route first', () => {
  expect(summary(groupStockItems(items, 'place', ['pantry', 'Fridge']))).toEqual([
    ['Pantry', ['Rice']],
    ['Fridge', ['Milk', 'Yogurt']],
    ['Bathroom', ['Soap']],
  ]);
});

it('groups by store, A to Z, with an item under each store that sells it', () => {
  expect(summary(groupStockItems(items, 'store'))).toEqual([
    ['Market', ['Rice']],
    ['Pharmacy', ['Soap']],
    ['Supermarket', ['Milk', 'Rice', 'Yogurt']],
  ]);
});

it('keeps the order it is given within each group, and has unique keys', () => {
  const groups = groupStockItems([yogurt, milk], 'place');
  expect(summary(groups)).toEqual([['fridge', ['Yogurt', 'Milk']]]);

  const keys = groupStockItems(items, 'store').map((group) => group.key);
  expect(new Set(keys).size).toBe(keys.length);
});

it('keeps everything in one group without grouping', () => {
  expect(groupStockItems(items, 'none')).toEqual([{ key: 'all', title: '', items }]);
  expect(groupStockItems([], 'place')).toEqual([]);
});
