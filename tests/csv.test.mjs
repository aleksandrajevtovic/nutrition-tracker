import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const {dailyCsv, csvHeaders} = await loadTypeScript(new URL('../src/csv.ts', import.meta.url));
const food = {id: 'private-food', name: 'Privater Rezeptname', brand: '', kcal: 100, protein: 10, carbs: 20, fat: 3, fiber: 2, sugar: 4, portionGrams: 100};
const entry = (id, date, grams) => ({id, date, grams, foodSnapshot: {...food}});
const entries = [entry('a', '2026-11-10', 150), entry('b', '2026-11-10', 50), entry('c', '2026-11-12', 0)];
const weights = [{date: '2026-11-10', kg: 72.5}, {date: '2026-11-11', kg: 72.25}];
const lines = csv => csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n').map(line => line.split(';'));

test('CSV sums daily nutrition snapshots, includes sugar and joins recorded weights by date', () => {
  const result = dailyCsv(entries, weights);
  assert.equal(result.rowCount, 3);
  const rows = lines(result.csv);
  assert.deepEqual(rows[0], csvHeaders);
  assert.deepEqual(rows[1], ['2026-11-10', '2', '200', '20', '40', '6', '4', '8', '72,5']);
  assert.deepEqual(rows[2], ['2026-11-11', '0', '', '', '', '', '', '', '72,25']);
  assert.deepEqual(rows[3], ['2026-11-12', '1', '0', '0', '0', '0', '0', '0', '']);
  assert.ok(!result.csv.includes(food.name));
  assert.ok(!result.csv.includes(food.id));
});

test('CSV date bounds are inclusive and can be specified independently', () => {
  assert.equal(dailyCsv(entries, weights, {from: '2026-11-11', to: '2026-11-12'}).rowCount, 2);
  assert.equal(dailyCsv(entries, weights, {from: '2026-11-12'}).rowCount, 1);
  assert.equal(dailyCsv(entries, weights, {to: '2026-11-10'}).rowCount, 1);
  assert.equal(dailyCsv(entries, weights, {from: '2027-01-01'}).rowCount, 0);
  assert.throws(() => dailyCsv(entries, weights, {from: '2026-11-12', to: '2026-11-10'}), /Zeitraum/);
  assert.throws(() => dailyCsv(entries, weights, {from: '2026-02-30'}), /Zeitraum/);
});

test('UTF-8 BOM, German decimals and CRLF produce spreadsheet-friendly numeric cells', () => {
  const result = dailyCsv([entry('a', '2026-11-10', 3000.12345)], []);
  assert.equal(result.csv.charCodeAt(0), 0xfeff);
  assert.ok(result.csv.endsWith('\r\n'));
  const row = lines(result.csv)[1];
  assert.equal(row[2], '3000,123');
  assert.equal(row[3], '300,012');
  assert.equal(row.length, 9);
});

test('export rejects invalid dates and non-finite nutrition instead of writing corrupt cells', () => {
  assert.throws(() => dailyCsv([entry('a', '=SUM(1)', 100)], []), /Ungültige Daten/);
  assert.throws(() => dailyCsv([entry('a', '2026-11-10', Infinity)], []), /Ungültige Daten/);
  const empty = dailyCsv([], []);
  assert.equal(empty.rowCount, 0);
  assert.equal(lines(empty.csv).length, 1);
});
