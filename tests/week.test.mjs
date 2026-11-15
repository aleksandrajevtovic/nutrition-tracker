import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './helpers/typescript.mjs';

const {calendarWeek, summarizeWeek, shiftDate} = await loadTypeScript(new URL('../src/week.ts', import.meta.url));
const {default: WeeklyNutritionChart} = await loadTypeScript(new URL('../src/components/WeeklyNutritionChart.tsx', import.meta.url));
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const food = {id: 'food', name: 'Lachs', brand: '', kcal: 200, protein: 20, carbs: 0, fat: 12,
  fiber: 0, sugar: 0, portionName: '1 Portion', portionGrams: 100, createdAt: '2026-11-15T00:00:00Z'};
const entry = (id, date, grams = 100) => ({id, foodId: food.id, date, meal: 'Mittagessen', grams, foodSnapshot: {...food}, createdAt: food.createdAt});
const weight = (date, kg) => ({date, kg, updatedAt: food.createdAt});

test('calendar weeks start on Monday and use the correct ISO year at year boundaries', () => {
  const week = calendarWeek('2026-11-15');
  assert.equal(week.start, '2026-11-09');
  assert.equal(week.end, '2026-11-15');
  assert.equal(week.dates.length, 7);
  assert.deepEqual([calendarWeek('2021-01-01').number, calendarWeek('2021-01-01').year], [53, 2020]);
  assert.deepEqual([calendarWeek('2024-12-30').number, calendarWeek('2024-12-30').year], [1, 2025]);
  assert.equal(shiftDate('2028-03-01', -1), '2028-02-29');
  assert.throws(() => calendarWeek('2026-02-30'), /gültiges Datum/);
});

test('daily totals use snapshots and average only days with entries, including real zero nutrients', () => {
  const entries = [entry('a', '2026-11-09'), entry('b', '2026-11-09', 50), entry('c', '2026-11-11', 200), entry('outside', '2026-11-16')];
  const summary = summarizeWeek(entries, [], '2026-11-15');
  assert.equal(summary.recordedDays, 2);
  assert.equal(summary.days[0].count, 2);
  assert.equal(summary.days[0].totals.kcal, 300);
  assert.equal(summary.totals.kcal, 700);
  assert.equal(summary.averages.kcal, 350);
  assert.equal(summary.averages.protein, 35);
  assert.equal(summary.averages.carbs, 0);
  assert.equal(summary.days[1].count, 0);
  assert.equal(summary.days[1].weight, undefined);
});

test('weight means and changes use actual measurements without carrying missing days forward', () => {
  const records = [weight('2026-11-15', 72), weight('2026-11-09', 73), weight('2026-11-16', 100)];
  const summary = summarizeWeek([], records, '2026-11-15');
  assert.equal(summary.weightAverage, 72.5);
  assert.equal(summary.measuredDays, 2);
  assert.equal(summary.weightChange, -1);
  assert.equal(summary.averages, undefined);
  assert.equal(summarizeWeek([], [records[0]], '2026-11-15').weightChange, undefined);
  const empty = summarizeWeek([], [], '2026-11-15');
  assert.equal(empty.weightAverage, undefined);
  assert.equal(empty.recordedDays, 0);
});

test('empty and populated comparison charts render seven accessible day buttons without invalid values', () => {
  for (const entries of [[], [entry('a', '2026-11-09')]]) {
    const week = summarizeWeek(entries, [], '2026-11-15');
    const html = renderToStaticMarkup(createElement(WeeklyNutritionChart, {week, goals: {kcal: 2000}, onOpenDay() {}}));
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.equal((html.match(/Im Tagebuch öffnen/g) ?? []).length, 7);
    assert.ok(html.includes('Keine Einträge'));
    if (entries.length) assert.ok(html.includes('200 kcal'));
  }
});

test('the period query loads inclusive boundaries, goal settings and updates after edits/deletion', async () => {
  const entries = [entry('before', '2026-11-08'), entry('first', '2026-11-09'), entry('last', '2026-11-15'), entry('after', '2026-11-16')];
  for (const record of entries) await db.saveEntry(record);
  for (const record of [weight('2026-11-08', 74), weight('2026-11-09', 73), weight('2026-11-15', 72), weight('2026-11-16', 71)]) await db.saveWeight(record);
  await db.saveDailyGoals({kcal: 2000});
  await db.saveFood({...food, kcal: 999});
  const data = await db.getPeriodData('2026-11-09', '2026-11-15');
  assert.deepEqual(data.entries.map(record => record.id), ['first', 'last']);
  assert.deepEqual(data.weights.map(record => record.kg), [73, 72]);
  assert.deepEqual(data.goals, {kcal: 2000});
  assert.equal(summarizeWeek(data.entries, data.weights, '2026-11-15').averages.kcal, 200);
  const revision = db.getDataRevision();
  const deleted = await db.removeEntry('first');
  assert.equal((await db.getPeriodData('2026-11-09', '2026-11-15')).entries.length, 1);
  await db.restoreDeletedEntry(deleted, revision);
  assert.equal((await db.getPeriodData('2026-11-09', '2026-11-15')).entries.length, 2);
  await assert.rejects(db.getPeriodData('2026-11-15', '2026-11-09'), /gültiges Datum/);
});
