import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const {itemsFromEntries, itemsToEntries, validMealItem} = await loadTypeScript(new URL('../src/planning.ts', import.meta.url));
const {dailyCsv} = await loadTypeScript(new URL('../src/csv.ts', import.meta.url));
const food = {id: 'food', name: 'Kartoffel', brand: '', kcal: 77, protein: 2, carbs: 17, fat: .1, fiber: 2.2, sugar: .8,
  portionName: 'Mittel', portionGrams: 150, createdAt: '2026-11-15T00:00:00Z'};
const entry = {id: 'one', foodId: food.id, date: '2026-11-15', meal: 'Mittagessen', grams: 150, amount: 1, unit: 'portion', foodSnapshot: food, createdAt: food.createdAt,
  note: 'Mit Kräutern zubereitet.\nNach dem Training. <b>Nur Text</b>'};

test('entry notes persist, update, clear and never change product data or daily CSV totals', async () => {
  await db.saveFood(food);
  await db.saveEntry(entry);
  assert.equal((await db.listEntries(entry.date))[0].note, entry.note);
  assert.deepEqual((await db.listFoods())[0], food);
  assert.ok(!dailyCsv([entry], []).csv.includes('Kräutern'));
  await db.saveEntry({...entry, note: 'Neue Notiz'});
  assert.equal((await db.listEntries(entry.date)).length, 1);
  assert.equal((await db.listEntries(entry.date))[0].note, 'Neue Notiz');
  const {note: _note, ...cleared} = entry;
  await db.saveEntry(cleared);
  assert.equal((await db.listEntries(entry.date))[0].note, undefined);
  await assert.rejects(db.saveEntry({...entry, note: {text: 'wrong'}}), /Eintragsnotiz/);
});

test('copy, undo and reusable meal items preserve notes independently', async () => {
  await db.saveEntry(entry);
  const copies = await db.copyMealEntries(entry.date, entry.meal, '2026-11-16', entry.meal);
  assert.equal(copies[0].note, entry.note);
  const items = itemsFromEntries([entry]);
  assert.equal(items[0].note, entry.note);
  assert.equal(validMealItem({...items[0], note: 123}), false);
  assert.equal(itemsToEntries(items, '2026-11-17', 'Abendessen')[0].note, entry.note);
  const revision = db.getDataRevision();
  const deleted = await db.removeEntry(entry.id);
  await db.restoreDeletedEntry(deleted, revision);
  assert.equal((await db.listEntries(entry.date))[0].note, entry.note);
});

test('backup import restores notes and rejects malformed notes before replacing data', async () => {
  const backup = JSON.parse(JSON.stringify(await db.getBackup()));
  await db.saveEntry({...entry, note: 'Vor Import'});
  await db.restoreBackup(backup);
  assert.equal((await db.listEntries(entry.date))[0].note, entry.note);
  for (const note of [null, false, 12, ['text'], {}]) {
    const invalid = structuredClone(backup);
    invalid.entries[0].note = note;
    await assert.rejects(db.restoreBackup(invalid), /Tagebucheinträge/);
    assert.equal((await db.listEntries(entry.date))[0].note, entry.note);
  }
  const legacy = {version: 1, exportedAt: food.createdAt, foods: [food], entries: [{...entry}]};
  delete legacy.entries[0].note;
  await db.restoreBackup(legacy);
  assert.equal((await db.listEntries(entry.date))[0].note, undefined);
});
