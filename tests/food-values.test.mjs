import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const {referenceGrams, scaleNutrients, portionOptions, selectPortion} = await loadTypeScript(new URL('../src/foodValues.ts', import.meta.url));
const {stats, toGrams, validFood} = await loadTypeScript(new URL('../src/nutrition.ts', import.meta.url));
const {makeIngredient, recipeTotals, validIngredient} = await loadTypeScript(new URL('../src/recipes.ts', import.meta.url));
const {itemFromFood, validMealItem} = await loadTypeScript(new URL('../src/planning.ts', import.meta.url));
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const input = {id: 'potato', name: 'Kartoffel', brand: '', kcal: 116, protein: 3, carbs: 25.5, fat: .2, fiber: 3.3, sugar: 1.2,
  portionName: 'Mittel', portionGrams: 150, portions: [{name: 'Klein', grams: 80}, {name: 'Groß', grams: 250}],
  nutritionReference: {unit: 'portion', amount: 1}, createdAt: '2026-11-15T00:00:00Z'};
const food = scaleNutrients(input, 100 / referenceGrams(input, input.nutritionReference));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('portion and arbitrary gram inputs normalize once and reproduce the entered nutrients', () => {
  assert.equal(referenceGrams(input, input.nutritionReference), 150);
  close(stats(food, 150).kcal, 116);
  close(stats(food, 150).protein, 3);
  close(food.sugar * 1.5, 1.2);
  const reopened = scaleNutrients(food, referenceGrams(food, food.nutritionReference) / 100);
  for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar']) close(reopened[key], input[key]);
  const custom = scaleNutrients(input, 100 / referenceGrams(input, {unit: 'g', amount: 150}));
  close(custom.kcal, food.kcal);
  assert.equal(validFood(food), true);
});

test('volume reference uses density and rejects missing or invalid reference metadata', () => {
  const liquid = {...input, gramsPerMl: .92, nutritionReference: {unit: 'ml', amount: 100}};
  assert.equal(referenceGrams(liquid, liquid.nutritionReference), 92);
  const normalized = scaleNutrients(liquid, 100 / 92);
  close(stats(normalized, toGrams(normalized, 100, 'ml')).kcal, 116);
  for (const nutritionReference of [null, {unit: 'g', amount: 0}, {unit: 'g', amount: Infinity}, {unit: 'x', amount: 100}, {unit: 'ml', amount: 100}, {unit: 'portion', amount: 2}]) {
    assert.equal(validFood({...food, nutritionReference}), false);
  }
});

test('portion presets keep the library intact and freeze quantities for diary, recipes and plans', () => {
  const small = selectPortion(food, 'Klein');
  const large = selectPortion(small, 'Groß');
  assert.equal(food.portionName, 'Mittel');
  assert.equal(food.portionGrams, 150);
  assert.equal(toGrams(small, 2, 'portion'), 160);
  close(stats(large, toGrams(large, .5, 'portion')).kcal, 116 / 150 * 125);
  assert.deepEqual(portionOptions(small).map(p => p.name).sort(), ['Groß', 'Klein', 'Mittel']);
  assert.equal(selectPortion(large, 'Mittel').portionGrams, 150);
  assert.equal(validFood(small), true);
  const ingredient = makeIngredient(small, 2, 'portion');
  assert.equal(validIngredient(ingredient), true);
  close(recipeTotals([ingredient]).kcal, 116 / 150 * 160);
  const planned = itemFromFood(large, 1, 'portion');
  assert.equal(validMealItem(planned), true);
  assert.equal(planned.grams, 250);
});

test('duplicate names and invalid portion weights fail validation', () => {
  for (const portions of [null, [{}], [{name: '', grams: 80}], [{name: 'Klein', grams: 0}], [{name: 'Klein', grams: NaN}], [{name: 'Mittel', grams: 90}], [{name: 'Klein', grams: 80}, {name: ' Klein ', grams: 90}]]) {
    assert.equal(validFood({...food, portions}), false);
  }
});

test('product presets and historical selected sizes survive backup import; malformed imports are atomic', async () => {
  await db.saveFood(food);
  const snapshot = selectPortion(food, 'Groß');
  await db.saveEntry({id: 'entry', foodId: food.id, date: '2026-11-15', meal: 'Mittagessen', amount: 1, unit: 'portion', grams: 250, foodSnapshot: snapshot, createdAt: food.createdAt});
  const backup = JSON.parse(JSON.stringify(await db.getBackup()));
  await db.restoreBackup(backup);
  assert.deepEqual((await db.listFoods())[0], food);
  const entry = (await db.listEntries('2026-11-15'))[0];
  assert.equal(entry.foodSnapshot.portionName, 'Groß');
  assert.equal(toGrams(entry.foodSnapshot, entry.amount, entry.unit), 250);
  await db.saveFood({...food, portionGrams: 160});
  assert.equal((await db.listEntries(entry.date))[0].foodSnapshot.portionGrams, 250);
  const invalid = structuredClone(backup);
  invalid.foods[0].portions[0].grams = -80;
  await assert.rejects(db.restoreBackup(invalid), /Produktdaten/);
  assert.equal((await db.listFoods())[0].portionGrams, 160);
});
