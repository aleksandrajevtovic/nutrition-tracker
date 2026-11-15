import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const {summarizeWeek} = await loadTypeScript(new URL('../src/week.ts', import.meta.url));
const {dailyCsv, weeklyCsv, csvHeaders, weeklyCsvHeaders} = await loadTypeScript(new URL('../src/csv.ts', import.meta.url));
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const drink = (id, date, ml) => ({id, date, ml, name: 'Privater Getränkename', time: '12:00', createdAt: '2026-11-15T00:00:00Z'});
const drinks = [drink('before', '2026-11-02', 600), drink('mon-a', '2026-11-09', 250), drink('mon-b', '2026-11-09', 500), drink('wed', '2026-11-11', 1250), drink('after', '2026-11-16', 9999)];
const food = {id: 'food', name: 'Eigenes Lebensmittel', brand: '', kcal: 200, protein: 20, carbs: 0, fat: 12, fiber: 2, sugar: 3, portionName: '1 Portion', portionGrams: 100, createdAt: '2026-11-15T00:00:00Z'};
const entry = {id: 'entry', foodId: food.id, date: '2026-11-09', meal: 'Frühstück', grams: 100, foodSnapshot: food, createdAt: food.createdAt};
const weight = {date: '2026-11-10', kg: 72.5, updatedAt: food.createdAt};
const rows = csv => csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n').map(line => line.split(';'));

test('weekly hydration averages use recorded days, not beverage count or seven assumed days', () => {
  const summary = summarizeWeek([entry], [weight], '2026-11-15', drinks);
  assert.equal(summary.drinkTotalMl, 2000);
  assert.equal(summary.drinkingDays, 2);
  assert.equal(summary.drinkAverageMl, 1000);
  assert.equal(summary.days[0].drinkCount, 2);
  assert.equal(summary.days[0].drinkMl, 750);
  assert.equal(summary.days[1].drinkMl, undefined);
  assert.equal(summary.days[2].drinkMl, 1250);
  assert.equal(summary.days[2].count, 0);
  assert.equal(summary.averages.kcal, 200);
  assert.equal(summarizeWeek([], [], '2026-11-15').drinkAverageMl, undefined);
  assert.equal(summarizeWeek([], [], '2026-11-08', drinks).drinkAverageMl, 600);
});

test('daily CSV includes drink-only days and leaves other absent fields blank', () => {
  const result = dailyCsv([entry], [weight], {from: '2026-11-09', to: '2026-11-15'}, drinks);
  assert.equal(result.rowCount, 3);
  const data = rows(result.csv);
  assert.deepEqual(data[0], csvHeaders);
  assert.equal(data[1][9], '750');
  assert.equal(data[2][8], '72,5');
  assert.equal(data[2][9], '');
  assert.deepEqual(data[3], ['2026-11-11', '0', '', '', '', '', '', '', '', '1250']);
  assert.ok(!result.csv.includes('Privater Getränkename'));
});

test('weekly CSV matches the weekly overview while keeping separate nutrition, weight and drink denominators', () => {
  const result = weeklyCsv([entry], [weight], {from: '2026-11-09', to: '2026-11-15'}, drinks);
  assert.equal(result.rowCount, 1);
  const data = rows(result.csv);
  assert.deepEqual(data[0], weeklyCsvHeaders);
  assert.deepEqual(data[1], ['2026-11-09', '2026-11-15', '2026-11-09', '2026-11-15', '1', '200', '20', '0', '12', '2', '3', '1', '72,5', '2', '2000', '1000']);
  assert.equal(result.csv.charCodeAt(0), 0xfeff);
});

test('date bounds restrict partial-week averages and expose the evaluated interval explicitly', () => {
  const result = rows(weeklyCsv([entry], [weight], {from: '2026-11-11', to: '2026-11-15'}, drinks).csv)[1];
  assert.deepEqual(result.slice(0, 5), ['2026-11-09', '2026-11-15', '2026-11-11', '2026-11-15', '0']);
  assert.equal(result[5], '');
  assert.equal(result[12], '');
  assert.deepEqual(result.slice(13), ['1', '1250', '1250']);
  const boundary = rows(weeklyCsv([], [], {}, [drink('a', '2021-01-01', 100), drink('b', '2021-01-03', 300)]).csv);
  assert.equal(boundary.length, 2);
  assert.deepEqual(boundary[1].slice(0, 2), ['2020-12-28', '2021-01-03']);
  assert.deepEqual(boundary[1].slice(13), ['2', '400', '200']);
});

test('empty exports and invalid dates or drink values do not invent zeros or corrupt numeric cells', () => {
  assert.equal(weeklyCsv([], [], {}, []).rowCount, 0);
  assert.equal(rows(weeklyCsv([], [weight]).csv)[1][15], '');
  for (const ml of [0, -1, Infinity, NaN]) assert.throws(() => dailyCsv([], [], {}, [drink('bad', '2026-11-09', ml)]), /Ungültige Daten/);
  assert.throws(() => weeklyCsv([], [], {from: '2026-11-15', to: '2026-11-09'}, drinks), /Zeitraum/);
  assert.throws(() => weeklyCsv([], [], {}, [drink('bad', '2026-02-30', 250)]), /Ungültige Daten/);
});

test('period queries include drinks at both boundaries and reflect edit, deletion and undo', async () => {
  for (const item of drinks) await db.saveDrink(item);
  await db.saveEntry(entry); await db.saveWeight(weight);
  const data = await db.getPeriodData('2026-11-09', '2026-11-11');
  assert.deepEqual(data.drinks.map(drink => drink.id), ['mon-a', 'mon-b', 'wed']);
  await db.saveDrink({...drinks[3], ml: 500});
  assert.equal(summarizeWeek([], [], '2026-11-15', (await db.getPeriodData('2026-11-09', '2026-11-15')).drinks).drinkAverageMl, 625);
  const revision = db.getDataRevision();
  const removed = await db.removeDrink('wed');
  assert.equal((await db.getPeriodData('2026-11-09', '2026-11-15')).drinks.length, 2);
  await db.restoreDeletedDrink(removed, revision);
  assert.equal((await db.getPeriodData('2026-11-09', '2026-11-15')).drinks.length, 3);
});
