import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const {filterFoods} = await loadTypeScript(new URL('../src/foods.ts', import.meta.url));
const {nextDate} = await loadTypeScript(new URL('../src/diary.ts', import.meta.url));
const food = {id: 'lachs', name: 'Lachs', brand: '', kcal: 200, protein: 20, carbs: 0, fat: 12,
  fiber: 0, sugar: 0, portionName: '1 Filet', portionGrams: 150, createdAt: '2026-11-15T00:00:00.000Z'};
const entry = {id: 'first', foodId: food.id, date: '2026-11-15', meal: 'Mittagessen', grams: 150,
  amount: 1, unit: 'portion', foodSnapshot: food, createdAt: food.createdAt};

test('favorites are prioritized and search still finds non-favorites by name and brand', () => {
  const records = [{...food, id: 'a', name: 'Avocado'}, {...food, id: 'b', name: 'Banane', favorite: true, brand: 'Bio'}, food];
  assert.deepEqual(filterFoods(records, '').map(f => f.id), ['b', 'a', 'lachs']);
  assert.deepEqual(filterFoods(records, 'bio ban').map(f => f.id), ['b']);
  assert.deepEqual(filterFoods(records, 'LACHS').map(f => f.id), ['lachs']);
  assert.deepEqual(filterFoods(records, '', true).map(f => f.id), ['b']);
  assert.equal(records[0].id, 'a');
});

test('the default copy date crosses month, leap-day and year boundaries', () => {
  assert.equal(nextDate('2026-12-31'), '2027-01-01');
  assert.equal(nextDate('2028-02-28'), '2028-02-29');
});

test('copy, favorites and undo use persistent storage safely', async t => {
  await db.saveFood(food);
  await db.saveEntry(entry);
  const second = {...entry, id: 'second', grams: 50, amount: 50, unit: 'g', createdAt: '2026-11-15T00:01:00.000Z'};
  await db.saveEntry(second);
  await db.saveEntry({...entry, id: 'other-meal', meal: 'Abendessen'});
  await db.saveEntry({...entry, id: 'existing-target', date: '2026-11-16'});

  await t.test('copying appends all meal entries with fresh IDs and preserves their snapshots and units', async () => {
    await db.saveFood({...food, kcal: 999});
    const copies = await db.copyMealEntries(entry.date, entry.meal, '2026-11-16', 'Frühstück');
    assert.equal(copies.length, 2);
    assert.equal(new Set(copies.map(e => e.id)).size, 2);
    assert.ok(copies.every(e => !['first', 'second'].includes(e.id)));
    assert.deepEqual(copies.map(e => [e.grams, e.amount, e.unit]), [[150, 1, 'portion'], [50, 50, 'g']]);
    assert.deepEqual(copies[0].foodSnapshot, food);
    assert.ok(copies.every(e => e.meal === 'Frühstück' && e.date === '2026-11-16'));
    assert.equal((await db.listEntries('2026-11-16')).length, 3);
    assert.equal((await db.listEntries(entry.date)).length, 3);
  });

  await t.test('invalid and empty copy operations leave existing entries intact', async () => {
    const before = (await db.getBackup()).entries;
    await assert.rejects(db.copyMealEntries(entry.date, entry.meal, '2026-02-30', 'Frühstück'), /Zieldatum/);
    await assert.rejects(db.copyMealEntries(entry.date, 'Unbekannt', '2026-11-16', 'Frühstück'), /keine Einträge/);
    assert.deepEqual((await db.getBackup()).entries, before);
  });

  await t.test('a removed product does not prevent copying historical entries', async () => {
    await db.removeFood(food.id);
    const copies = await db.copyMealEntries(entry.date, entry.meal, '2026-11-17', entry.meal);
    assert.equal(copies.length, 2);
    assert.equal(copies[0].foodSnapshot.kcal, 200);
    await db.saveFood(food);
  });

  await t.test('favorites survive a backup round trip and invalid flags are rejected before replacement', async () => {
    const updated = await db.toggleFoodFavorite(food.id);
    assert.equal(updated.favorite, true);
    assert.equal(updated.kcal, food.kcal);
    const backup = await db.getBackup();
    await db.toggleFoodFavorite(food.id);
    await db.restoreBackup(JSON.parse(JSON.stringify(backup)));
    assert.equal((await db.listFoods())[0].favorite, true);
    backup.foods[0].favorite = 'yes';
    await assert.rejects(db.restoreBackup(backup), /Produktdaten/);
    assert.equal((await db.listFoods())[0].favorite, true);
  });

  await t.test('undo restores the exact deleted diary entry once', async () => {
    const revision = db.getDataRevision();
    const deleted = await db.removeEntry(entry.id);
    assert.deepEqual(deleted, entry);
    assert.ok(!(await db.listEntries(entry.date)).some(e => e.id === entry.id));
    await db.restoreDeletedEntry(deleted, revision);
    assert.deepEqual((await db.listEntries(entry.date)).find(e => e.id === entry.id), entry);
    await assert.rejects(db.restoreDeletedEntry(deleted, revision), /nicht überschrieben/);
  });

  await t.test('undo restores deleted products with their favorite status', async () => {
    const revision = db.getDataRevision();
    const deleted = await db.removeFood(food.id);
    assert.equal(deleted.favorite, true);
    await db.restoreDeletedFood(deleted, revision);
    assert.deepEqual((await db.listFoods())[0], deleted);
    assert.equal((await db.listEntries(entry.date)).length, 3);
  });

  await t.test('weight undo restores its value and never overwrites a later measurement', async () => {
    const weight = {date: entry.date, kg: 72.5, updatedAt: entry.createdAt};
    const revision = db.getDataRevision();
    await db.saveWeight(weight);
    const deleted = await db.removeWeight(weight.date);
    await db.restoreDeletedWeight(deleted, revision);
    assert.deepEqual(await db.listWeights(), [weight]);
    await db.removeWeight(weight.date);
    await db.saveWeight({...weight, kg: 73});
    await assert.rejects(db.restoreDeletedWeight(deleted, revision), /nicht überschrieben/);
    assert.equal((await db.listWeights())[0].kg, 73);
  });

  await t.test('a data import invalidates pending undo actions', async () => {
    const revision = db.getDataRevision();
    const deleted = await db.removeFood(food.id);
    await db.restoreBackup(await db.getBackup());
    await assert.rejects(db.restoreDeletedFood(deleted, revision), /Datenimport/);
    assert.deepEqual(await db.listFoods(), []);
  });
});
