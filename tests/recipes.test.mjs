import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const {makeIngredient, recipeTotals, validRecipe, validRecipeFood, buildRecipeFood} = await loadTypeScript(new URL('../src/recipes.ts', import.meta.url));
const {stats, toGrams} = await loadTypeScript(new URL('../src/nutrition.ts', import.meta.url));
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const banana = {id: 'banana', name: 'Banane', brand: '', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3,
  fiber: 2.6, sugar: 12.2, portionName: '1 Banane', portionGrams: 100, createdAt: '2026-11-15T00:00:00Z'};
const oil = {...banana, id: 'oil', name: 'Öl', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, gramsPerMl: 0.92};
const base = {...banana, id: 'recipe', name: 'Bananenmix', brand: 'Eigenes Rezept'};
const ingredients = [makeIngredient(banana, 2, 'portion'), makeIngredient(oil, 10, 'g')];
const recipe = {ingredients, servings: 2, yieldGrams: 180, instructions: 'Vermischen.'};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('recipe totals include every nutrient and preserve the original ingredient snapshots', () => {
  const totals = recipeTotals(ingredients);
  close(totals.kcal, 266.4);
  close(totals.grams, 210);
  close(totals.sugar, 24.4);
  close(totals.fiber, 5.2);
  assert.notEqual(ingredients[0].foodSnapshot, banana);
  assert.equal(validRecipe(recipe), true);
});

test('finished weight changes gram-based nutrition while portions retain their share of total nutrients', () => {
  const food = buildRecipeFood(base, recipe);
  assert.equal(food.portionGrams, 90);
  close(food.kcal, 148);
  close(stats(food, toGrams(food, 1, 'portion')).kcal, 133.2);
  close(stats(food, toGrams(food, 0.5, 'portion')).kcal, 66.6);
  close(stats(food, toGrams(food, 2, 'portion')).kcal, 266.4);
  const raw = buildRecipeFood(base, {...recipe, yieldGrams: 210});
  close(stats(raw, raw.portionGrams).kcal, 133.2);
  const four = buildRecipeFood(base, {...recipe, servings: 4});
  close(stats(four, four.portionGrams).kcal, 66.6);
  assert.equal(validRecipe({...recipe, autoWeight: true, yieldGrams: 210}), true);
  assert.equal(validRecipe({...recipe, autoWeight: true}), false);
});

test('volume ingredients use density and other recipes are flattened to nutrient snapshots', () => {
  const liquid = makeIngredient(oil, 100, 'ml');
  assert.equal(liquid.grams, 92);
  const existing = buildRecipeFood(base, recipe);
  const ingredient = makeIngredient(existing, 1, 'portion');
  assert.equal(ingredient.foodSnapshot.recipe, undefined);
  close(ingredient.foodSnapshot.kcal / 100 * ingredient.grams, 133.2);
});

test('invalid recipes and inconsistent quantities or calculated nutrients cannot be persisted', async () => {
  for (const changes of [{servings: 0}, {servings: Infinity}, {yieldGrams: 0}, {ingredients: []}, {ingredients: [ingredients[0], ingredients[0]]}, {ingredients: [{...ingredients[0], grams: 123}]}]) {
    assert.equal(validRecipe({...recipe, ...changes}), false);
  }
  const food = buildRecipeFood(base, recipe);
  assert.equal(validRecipeFood({...food, kcal: 999}), false);
  assert.equal(validRecipeFood({...food, portionGrams: 999}), false);
  await assert.rejects(db.saveFood({...food, kcal: 999}), /Rezeptdaten/);
});

test('recipes, diary snapshots, favorites, undo and backups work together', async t => {
  const food = buildRecipeFood({...base, favorite: true}, recipe);
  const entry = {id: 'meal', foodId: food.id, date: '2026-11-15', meal: 'Frühstück', amount: 0.5, unit: 'portion',
    grams: 45, foodSnapshot: structuredClone(food), createdAt: banana.createdAt};
  await db.saveFood(banana);
  await db.saveFood(food);
  await db.saveEntry(entry);
  await t.test('editing the recipe or deleting its source food keeps old diary nutrition intact', async () => {
    await db.saveFood(buildRecipeFood(food, {...recipe, servings: 4}));
    await db.removeFood(banana.id);
    const saved = (await db.listEntries(entry.date))[0];
    assert.equal(saved.foodSnapshot.recipe.servings, 2);
    assert.equal(saved.grams, 45);
    close(stats(saved.foodSnapshot, saved.grams).kcal, 66.6);
    assert.equal((await db.listFoods())[0].recipe.ingredients[0].foodSnapshot.name, 'Banane');
  });
  await t.test('recipe data and frozen diary portions survive a backup round trip', async () => {
    const backup = await db.getBackup();
    await db.removeFood(food.id);
    await db.removeEntry(entry.id);
    await db.restoreBackup(JSON.parse(JSON.stringify(backup)));
    const restored = (await db.listFoods())[0];
    assert.equal(restored.recipe.servings, 4);
    assert.equal(restored.recipe.instructions, 'Vermischen.');
    assert.equal(restored.favorite, true);
    assert.equal((await db.listEntries(entry.date))[0].foodSnapshot.recipe.servings, 2);
  });
  await t.test('malformed ingredient data rejects the entire import before any data is replaced', async () => {
    const backup = await db.getBackup();
    const invalid = structuredClone(backup);
    invalid.foods[0].recipe.ingredients[0].grams = -1;
    invalid.entries = [];
    await assert.rejects(db.restoreBackup(invalid), /Produktdaten/);
    assert.deepEqual((await db.getBackup()).foods, backup.foods);
    assert.equal((await db.listEntries(entry.date)).length, 1);
  });
  await t.test('undo restores a deleted recipe with all of its ingredients', async () => {
    const revision = db.getDataRevision();
    const removed = await db.removeFood(food.id);
    await db.restoreDeletedFood(removed, revision);
    assert.deepEqual((await db.listFoods())[0], removed);
    assert.equal((await db.listFoods())[0].recipe.ingredients.length, 2);
  });
});
