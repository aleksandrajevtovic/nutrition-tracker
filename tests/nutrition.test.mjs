import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

// Run the actual TypeScript conversion module using the project's existing compiler.
const {toGrams, stats, validFood, isPositive} = await loadTypeScript(new URL('../src/nutrition.ts', import.meta.url));
const food = {
  id: 'lachs', name: 'Lachs', brand: '', kcal: 200, protein: 20, carbs: 0,
  fat: 12, fiber: 0, sugar: 0, portionName: '1 Filet', portionGrams: 150,
  createdAt: '2026-11-15T00:00:00.000Z',
};

test('mass units give identical nutrition for the same weight', () => {
  for (const [amount, unit] of [[150, 'g'], [150000, 'mg'], [0.15, 'kg'], [1, 'portion']]) {
    const grams = toGrams(food, amount, unit);
    assert.equal(grams, 150);
    assert.equal(stats(food, grams).kcal, 300);
    assert.equal(stats(food, grams).protein, 30);
  }
});

test('fractional portions, pieces, slices and custom portions use their own weights', () => {
  const configured = {...food, pieceGrams: 75, sliceGrams: 25};
  assert.equal(toGrams(configured, 0.5, 'portion'), 75);
  assert.equal(toGrams(configured, 2, 'piece'), 150);
  assert.equal(toGrams(configured, 6, 'slice'), 150);
});

test('litres and millilitres require an explicit density', () => {
  assert.ok(Number.isNaN(toGrams(food, 100, 'ml')));
  assert.ok(Number.isNaN(toGrams(food, 1, 'l')));
  const liquid = {...food, gramsPerMl: 0.92};
  assert.equal(toGrams(liquid, 250, 'ml'), 230);
  assert.equal(toGrams(liquid, 0.25, 'l'), 230);
});

test('legacy foods remain valid without newly added conversion fields', () => {
  assert.equal(validFood(food), true);
  assert.ok(Number.isNaN(toGrams(food, 1, 'piece')));
  assert.ok(Number.isNaN(toGrams(food, 1, 'slice')));
});

test('invalid nutrients, names and conversion weights cannot be saved', () => {
  for (const value of [0, -1, NaN, Infinity]) {
    for (const key of ['portionGrams', 'pieceGrams', 'sliceGrams', 'gramsPerMl']) {
      assert.equal(validFood({...food, [key]: value}), false, `${key}: ${value}`);
    }
    assert.equal(isPositive(value), false);
  }
  for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar']) {
    for (const value of [-1, NaN, Infinity]) assert.equal(validFood({...food, [key]: value}), false);
  }
  assert.equal(validFood({...food, name: ' '}), false);
  assert.equal(validFood({...food, portionName: ' '}), false);
});

test('entry snapshot conversions survive a JSON backup round trip', () => {
  const original = {...food, pieceGrams: 75};
  const entry = {amount: 2, unit: 'piece', grams: toGrams(original, 2, 'piece'), foodSnapshot: {...original}};
  original.pieceGrams = 100;
  original.kcal = 500;
  const restored = JSON.parse(JSON.stringify(entry));
  assert.equal(toGrams(restored.foodSnapshot, restored.amount, restored.unit), restored.grams);
  assert.equal(stats(restored.foodSnapshot, restored.grams).kcal, 300);
});
