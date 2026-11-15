import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {openDB} from 'idb';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './helpers/typescript.mjs';

const {validGoals, parseGoals, goalProgress, backupGoals} = await loadTypeScript(new URL('../src/goals.ts', import.meta.url));
const weight = {date: '2026-11-15', kg: 72.5, updatedAt: '2026-11-15T00:00:00.000Z'};
const previous = await openDB('nutrition-tracker', 3, {upgrade(db) {
  db.createObjectStore('foods', {keyPath: 'id'});
  db.createObjectStore('entries', {keyPath: 'id'}).createIndex('by-date', 'date');
  db.createObjectStore('weights', {keyPath: 'date'});
}});
await previous.put('weights', weight);
previous.close();
const {GoalProgress} = await loadTypeScript(new URL('../src/components/DailySummary.tsx', import.meta.url));
const empty = {kcal: '', protein: '', carbs: '', fat: '', fiber: ''};

test('goals accept optional targets and German decimals without inventing defaults', () => {
  assert.deepEqual(parseGoals(empty), {});
  assert.deepEqual(parseGoals({...empty, kcal: '2000', protein: '100,5', fiber: ' 25.5 '}), {kcal: 2000, protein: 100.5, fiber: 25.5});
  for (const value of ['0', '-5', '1e2', 'NaN', '1,2,3', 'Infinity']) assert.throws(() => parseGoals({...empty, protein: value}));
  for (const goals of [null, [], {unknown: 1}, {kcal: 0}, {kcal: Infinity}, {protein: '100'}]) assert.equal(validGoals(goals), false);
});

test('progress caps the visual bar while preserving the actual percentage and amount above target', () => {
  assert.deepEqual(goalProgress(0, 100), {percent: 0, barPercent: 0, difference: 100});
  assert.deepEqual(goalProgress(50, 100), {percent: 50, barPercent: 50, difference: 50});
  assert.deepEqual(goalProgress(100, 100), {percent: 100, barPercent: 100, difference: 0});
  assert.deepEqual(goalProgress(125, 100), {percent: 125, barPercent: 100, difference: -25});
  assert.equal(goalProgress(0.1 + 0.2, 0.3).difference, 0);
});

test('progress uses accessible labels and German remaining/exceeded text', () => {
  for (const [current, text] of [[50, 'Noch 50 g'], [100, 'Ziel erreicht'], [125, '25 g über dem Ziel']]) {
    const html = renderToStaticMarkup(createElement(GoalProgress, {current, target: 100, label: 'Protein', unit: 'g'}));
    assert.ok(html.includes(text));
    assert.ok(html.includes('role="progressbar"'));
    assert.ok(html.includes(`aria-valuenow="${Math.min(current, 100)}"`));
    assert.ok(html.includes(`${current} von 100 g`));
  }
});

test('legacy backups do not replace targets; current backups explicitly include even empty goals', () => {
  assert.equal(backupGoals({version: 1}), undefined);
  assert.equal(backupGoals({version: 2}), undefined);
  assert.deepEqual(backupGoals({version: 3, goals: {}}), {});
  assert.throws(() => backupGoals({version: 3}), /Tagesziele/);
});

test('goal storage upgrades the existing database and preserves old backup compatibility', async t => {
  const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
  await t.test('upgrading leaves measurements intact and starts with no targets', async () => {
    assert.deepEqual(await db.getDailyGoals(), {});
    assert.deepEqual(await db.listWeights(), [weight]);
  });
  await t.test('targets persist in storage and are included in backup restoration', async () => {
    await db.saveDailyGoals({kcal: 2100, protein: 120});
    const backup = await db.getBackup();
    assert.equal(backup.version, 6);
    assert.deepEqual(backup.goals, {kcal: 2100, protein: 120});
    await db.saveDailyGoals({});
    await db.restoreBackup(JSON.parse(JSON.stringify(backup)));
    assert.deepEqual(await db.getDailyGoals(), backup.goals);
  });
  await t.test('invalid targets fail before other stores or settings are replaced', async () => {
    const backup = await db.getBackup();
    await assert.rejects(db.restoreBackup({...backup, weights: [], goals: {kcal: -1}}), /Tagesziele/);
    await assert.rejects(db.saveDailyGoals({kcal: 0}), /Tagesziele/);
    assert.deepEqual(await db.getDailyGoals(), backup.goals);
    assert.deepEqual(await db.listWeights(), [weight]);
  });
  await t.test('old backups preserve goals and current empty goals remove them', async () => {
    await db.restoreBackup({version: 1, foods: [], entries: []});
    assert.deepEqual(await db.getDailyGoals(), {kcal: 2100, protein: 120});
    await db.restoreBackup({version: 2, foods: [], entries: [], weights: [weight]});
    assert.deepEqual(await db.getDailyGoals(), {kcal: 2100, protein: 120});
    await db.restoreBackup({version: 3, foods: [], entries: [], weights: [weight], goals: {}});
    assert.deepEqual(await db.getDailyGoals(), {});
  });
});
