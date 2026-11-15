import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {openDB} from 'idb';
import {loadTypeScript} from './helpers/typescript.mjs';

const food = {id: 'lachs', name: 'Lachs', brand: '', kcal: 200, protein: 20, carbs: 0, fat: 12,
  fiber: 0, sugar: 0, portionName: '1 Filet', portionGrams: 150, createdAt: '2026-11-15T00:00:00.000Z'};
const entry = {id: 'entry', foodId: food.id, date: '2026-11-15', meal: 'Mittagessen', grams: 150,
  foodSnapshot: food, createdAt: food.createdAt};
const record = (date, kg) => ({date, kg, updatedAt: '2026-11-15T12:00:00.000Z'});

test('weight storage migration, daily updates and backup restoration preserve data', async t => {
  const previous = await openDB('nutrition-tracker', 2, {upgrade(db) {
    db.createObjectStore('foods', {keyPath: 'id'});
    db.createObjectStore('entries', {keyPath: 'id'}).createIndex('by-date', 'date');
  }});
  await previous.put('foods', food);
  await previous.put('entries', entry);
  previous.close();
  const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));

  await t.test('upgrade retains existing foods and diary entries', async () => {
    assert.deepEqual(await db.listFoods(), [food]);
    assert.deepEqual(await db.listEntries(entry.date), [entry]);
    assert.deepEqual(await db.listWeights(), []);
  });
  await t.test('saving the same date updates its single weight entry', async () => {
    await db.saveWeight(record('2026-11-15', 73));
    await db.saveWeight(record('2026-11-15', 72.5));
    assert.deepEqual(await db.listWeights(), [record('2026-11-15', 72.5)]);
    await assert.rejects(db.saveWeight(record('2026-11-15', 0)), /Gewichtsdaten/);
  });
  await t.test('current backups restore measurements along with diary data', async () => {
    const backup = await db.getBackup();
    assert.equal(backup.version, 6);
    assert.equal(backup.weights[0].kg, 72.5);
    await db.removeWeight('2026-11-15');
    assert.deepEqual(await db.listWeights(), []);
    await db.restoreBackup(JSON.parse(JSON.stringify(backup)));
    assert.deepEqual(await db.getBackup().then(b => b.weights), backup.weights);
    assert.deepEqual(await db.listEntries(entry.date), [entry]);
  });
  await t.test('invalid backups fail before any store is cleared', async () => {
    const backup = await db.getBackup();
    const original = structuredClone(backup);
    backup.foods = [];
    backup.weights = [record('2026-11-15', -1)];
    await assert.rejects(db.restoreBackup(backup), /Gewichtsdaten/);
    assert.deepEqual(await db.listFoods(), original.foods);
    assert.deepEqual(await db.listWeights(), original.weights);
  });
  await t.test('older backups retain weights; new backups with an empty list explicitly clear them', async () => {
    await db.restoreBackup({version: 1, foods: [food], entries: [entry]});
    assert.equal((await db.listWeights())[0].kg, 72.5);
    await db.restoreBackup({version: 2, foods: [food], entries: [entry], weights: []});
    assert.deepEqual(await db.listWeights(), []);
    assert.deepEqual(await db.listEntries(entry.date), [entry]);
  });
});
