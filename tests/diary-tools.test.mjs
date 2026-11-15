import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const {recentFoods, searchDiary, validDiaryRange} = await loadTypeScript(new URL('../src/diaryHistory.ts', import.meta.url));
const {withEntryAmount} = await loadTypeScript(new URL('../src/entryQuantity.ts', import.meta.url));
const {stats} = await loadTypeScript(new URL('../src/nutrition.ts', import.meta.url));
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const food = {id: 'potato', name: 'Kartoffel', brand: 'Bio', kcal: 77, protein: 2, carbs: 17, fat: .1, fiber: 2.2, sugar: .8,
  portionName: 'Mittel', portionGrams: 150, portions: [{name: 'Klein', grams: 80}], gramsPerMl: .92, pieceGrams: 150, sliceGrams: 30,
  createdAt: '2026-11-15T00:00:00Z'};
const entry = {id: 'one', foodId: food.id, date: '2026-11-15', meal: 'Mittagessen', grams: 150, amount: 1, unit: 'portion', foodSnapshot: food,
  note: 'Mit Kräutern\nNach dem Training. Großartig!', createdAt: '2026-11-15T10:00:00Z'};

test('recent foods deduplicate by product and use the latest logged quantity with current product values', () => {
  const latest = {...entry, id: 'two', amount: 2, grams: 300, date: '2026-11-14', createdAt: '2026-11-15T11:00:00Z'};
  const current = {...food, kcal: 90, portionGrams: 160};
  const result = recentFoods([entry, latest], [current]);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 2);
  assert.equal(result[0].grams, 320);
  assert.equal(result[0].food.kcal, 90);
  assert.equal(result[0].note, undefined);
  assert.equal(entry.foodSnapshot.kcal, 77);
  assert.deepEqual(recentFoods([entry], []), []);
});

test('recent portions preserve the selected size; removed sizes or conversion weights fall back to recorded grams', () => {
  const small = {...entry, grams: 160, amount: 2, foodSnapshot: {...food, portionName: 'Klein', portionGrams: 80}};
  const selected = recentFoods([small], [food])[0];
  assert.equal(selected.food.portionName, 'Klein');
  assert.equal(selected.grams, 160);
  assert.equal(food.portionName, 'Mittel');
  assert.deepEqual(recentFoods([small], [{...food, portions: []}]).map(({unit, amount, grams}) => [unit, amount, grams]), [['g', 160, 160]]);
  const volume = {...entry, unit: 'ml', amount: 100, grams: 92};
  assert.equal(recentFoods([volume], [{...food, gramsPerMl: undefined}])[0].grams, 92);
  assert.equal(recentFoods([volume], [{...food, gramsPerMl: undefined}])[0].unit, 'g');
  const many = Array.from({length: 8}, (_, i) => ({...entry, id: `entry-${i}`, foodId: `food-${i}`, foodSnapshot: {...food, id: `food-${i}`}}));
  assert.equal(recentFoods(many, many.map(value => value.foodSnapshot)).length, 6);
});

test('diary search matches names, brands, meals and multiline notes across days, ignoring case and German accents', () => {
  const older = {...entry, id: 'old', date: '2026-11-14'};
  const newest = {...entry, id: 'new', date: '2026-11-16', foodSnapshot: {...food, name: 'Gelöschtes Produkt'}};
  const entries = [entry, older, newest];
  assert.equal(searchDiary(entries, {text: 'BIO KRAUTERN training grossartig', from: '', to: ''}).length, 3);
  assert.equal(searchDiary(entries, {text: 'Mittag Kartoffel', from: '', to: ''}).length, 2);
  assert.equal(searchDiary(entries, {text: 'geloeschtes', from: '', to: ''}).length, 0);
  assert.equal(searchDiary(entries, {text: 'geloschtes', from: '', to: ''})[0].id, 'new');
  assert.deepEqual(searchDiary(entries, {text: '', from: '2026-11-14', to: '2026-11-15'}).map(value => value.id), ['one', 'old']);
  assert.equal(searchDiary(entries, {text: 'fehlt', from: '', to: ''}).length, 0);
  assert.equal(validDiaryRange({from: '2026-02-30', to: ''}), false);
  assert.equal(validDiaryRange({from: '2026-11-16', to: '2026-11-14'}), false);
  assert.equal(searchDiary(entries, {text: '', from: '2026-11-16', to: '2026-11-14'}).length, 0);
  assert.deepEqual(entries.map(value => value.id), ['one', 'old', 'new']);
});

test('quick quantities use historical conversions for every unit and preserve notes and entry identity', () => {
  for (const [unit, amount, grams] of [['g', 300, 300], ['mg', 300000, 300], ['kg', .3, 300], ['ml', 100, 92], ['l', .1, 92], ['portion', 2, 300], ['piece', 2, 300], ['slice', 10, 300]]) {
    const updated = withEntryAmount({...entry, unit}, amount);
    assert.equal(updated.grams, grams);
    assert.equal(updated.id, entry.id);
    assert.equal(updated.note, entry.note);
    assert.equal(updated.createdAt, entry.createdAt);
    assert.deepEqual(updated.foodSnapshot, entry.foodSnapshot);
  }
  const {amount: _amount, unit: _unit, ...legacy} = entry;
  assert.equal(withEntryAmount(legacy, 80).unit, 'g');
  assert.equal(withEntryAmount(legacy, 80).grams, 80);
  for (const amount of [0, -1, NaN, Infinity]) assert.throws(() => withEntryAmount(entry, amount), /Menge/);
  assert.throws(() => withEntryAmount({...entry, unit: 'ml', foodSnapshot: {...food, gramsPerMl: undefined}}, 100), /Menge/);
});

test('all-date history and atomic quantity updates preserve newer notes, snapshots and backup consistency', async () => {
  await db.saveFood({...food, kcal: 999, portionGrams: 999});
  await db.saveEntry(entry);
  await db.saveEntry({...entry, id: 'other', date: '2026-11-14'});
  assert.equal((await db.listDiaryHistory()).length, 2);
  await db.saveEntry({...entry, note: 'Neuere Notiz'});
  const updated = await db.changeEntryAmount(entry.id, 2);
  assert.equal(updated.note, 'Neuere Notiz');
  assert.equal(updated.grams, 300);
  assert.equal(stats(updated.foodSnapshot, updated.grams).kcal, 231);
  assert.equal((await db.listEntries(entry.date)).length, 1);
  await assert.rejects(db.changeEntryAmount(entry.id, 0), /Menge/);
  assert.equal((await db.listEntries(entry.date))[0].grams, 300);
  const backup = JSON.parse(JSON.stringify(await db.getBackup()));
  await db.restoreBackup(backup);
  assert.equal((await db.listEntries(entry.date))[0].grams, 300);
  await db.removeEntry(entry.id);
  await assert.rejects(db.changeEntryAmount(entry.id, 2), /nicht mehr vorhanden/);
  assert.equal((await db.listEntries(entry.date)).length, 0);
});
