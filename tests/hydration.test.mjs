import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {openDB} from 'idb';
import {loadTypeScript} from './helpers/typescript.mjs';

const {drinkMilliliters, createDrink, validDrink, drinkTimeline, backupDrinks} = await loadTypeScript(new URL('../src/hydration.ts', import.meta.url));
const previous = await openDB('nutrition-tracker', 6, {upgrade(db) {
  db.createObjectStore('foods', {keyPath: 'id'});
  db.createObjectStore('entries', {keyPath: 'id'}).createIndex('by-date', 'date');
  db.createObjectStore('weights', {keyPath: 'date'});
  db.createObjectStore('settings');
  db.createObjectStore('templates', {keyPath: 'id'});
  db.createObjectStore('plans', {keyPath: 'id'}).createIndex('by-date', 'date');
  db.createObjectStore('shopping');
  db.createObjectStore('notes', {keyPath: 'date'});
}});
await previous.put('weights', {date: '2026-11-15', kg: 72, updatedAt: '2026-11-15T00:00:00Z'});
await previous.put('notes', {date: '2026-11-15', hunger: '', energy: '', training: '', observations: 'Vorherige Notiz', updatedAt: '2026-11-15T00:00:00Z'});
await previous.put('settings', '2026-11-15T12:00:00Z', 'lastBackupExport');
previous.close();
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));

test('custom ml and litres accept German decimals and normalize without requiring food density', () => {
  assert.equal(drinkMilliliters('250', 'ml'), 250);
  assert.equal(drinkMilliliters('0,75', 'l'), 750);
  assert.equal(drinkMilliliters('1.25', 'l'), 1250);
  for (const text of ['', '0', '-1', '1.2.3', 'Infinity', '1e3']) assert.ok(Number.isNaN(drinkMilliliters(text, 'ml')));
  assert.ok(Number.isNaN(drinkMilliliters('1', 'kg')));
});

test('drink creation validates names, calendar dates and local times and preserves identity during edits', () => {
  const drink = createDrink('2026-11-15', ' Tee ', '0,5', 'l', '08:15');
  assert.equal(drink.name, 'Tee');
  assert.equal(drink.ml, 500);
  const updated = createDrink(drink.date, 'Kräutertee', '750', 'ml', '07:30', drink);
  assert.equal(updated.id, drink.id);
  assert.equal(updated.createdAt, drink.createdAt);
  for (const changes of [{date: '2026-02-30'}, {name: ' '}, {time: '24:00'}, {time: '12:60'}, {time: '8:00'}, {ml: 0}, {ml: Infinity}, {createdAt: 'invalid'}]) assert.equal(validDrink({...drink, ...changes}), false);
});

test('the daily timeline sorts by chosen time and shows cumulative amounts without changing input order', () => {
  const later = createDrink('2026-11-15', 'Wasser', '250', 'ml', '12:00');
  const earlier = createDrink('2026-11-15', 'Tee', '0,5', 'l', '08:00');
  assert.deepEqual(drinkTimeline([later, earlier]).map(drink => [drink.time, drink.totalMl]), [['08:00', 500], ['12:00', 750]]);
  assert.deepEqual(drinkTimeline([]), []);
});

test('migration, per-day storage, edits and undo preserve existing data and never duplicate edits', async () => {
  assert.equal((await db.listWeights())[0].kg, 72);
  assert.equal((await db.getDayNote('2026-11-15')).observations, 'Vorherige Notiz');
  assert.equal(await db.getLastBackupExport(), '2026-11-15T12:00:00Z');
  const one = createDrink('2026-11-15', 'Wasser', '250', 'ml', '12:00');
  const other = createDrink('2026-11-16', 'Kaffee', '200', 'ml', '08:00');
  await db.saveDrink(one); await db.saveDrink(other);
  await db.saveDrink({...one, ml: 300});
  assert.equal((await db.listDrinks(one.date)).length, 1);
  assert.equal((await db.listDrinks(one.date))[0].ml, 300);
  assert.equal((await db.listDrinks(other.date))[0].ml, 200);
  await assert.rejects(db.saveDrink({...one, ml: -1}), /Trinkdaten/);
  const revision = db.getDataRevision();
  const removed = await db.removeDrink(one.id);
  await db.restoreDeletedDrink(removed, revision);
  assert.equal((await db.listDrinks(one.date))[0].ml, 300);
  await assert.rejects(db.restoreDeletedDrink(removed, revision), /Änderungen/);
});

test('new backups restore all drinks; old formats preserve them; invalid imports leave every store intact', async () => {
  const backup = JSON.parse(JSON.stringify(await db.getBackup()));
  assert.equal(backup.version, 6);
  assert.equal(backup.drinks.length, 2);
  await db.removeDrink(backup.drinks[0].id);
  await db.restoreBackup(backup);
  assert.equal((await db.getBackup()).drinks.length, 2);
  const {drinks, ...old} = backup;
  await db.restoreBackup({...old, version: 5});
  assert.equal((await db.getBackup()).drinks.length, 2);
  assert.equal(backupDrinks({version: 5}), undefined);
  for (const invalid of [{...backup, drinks: undefined}, {...backup, drinks: [drinks[0], drinks[0]]}, {...backup, drinks: [{...drinks[0], ml: 0}]}]) {
    await assert.rejects(db.restoreBackup(invalid), /Trinkdaten/);
    assert.equal((await db.getBackup()).drinks.length, 2);
    assert.equal((await db.listWeights())[0].kg, 72);
  }
  const staleRevision = db.getDataRevision();
  const removed = await db.removeDrink(drinks[0].id);
  await db.restoreBackup({...backup, drinks: []});
  await assert.rejects(db.restoreDeletedDrink(removed, staleRevision), /Änderungen/);
  assert.equal((await db.getBackup()).drinks.length, 0);
  assert.equal((await db.getDayNote('2026-11-15')).observations, 'Vorherige Notiz');
});
