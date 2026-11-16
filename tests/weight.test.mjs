import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './helpers/typescript.mjs';

const {parseWeight, validWeight, weightComparison, weightsInRange, backupWeights, weightMeasurementDate} = await loadTypeScript(new URL('../src/weight.ts', import.meta.url));
const {default: WeightChart} = await loadTypeScript(new URL('../src/components/WeightChart.tsx', import.meta.url));
const {default: WeightEntryForm} = await loadTypeScript(new URL('../src/components/WeightEntryForm.tsx', import.meta.url));
const {default: ToastProvider} = await loadTypeScript(new URL('../src/components/ToastProvider.tsx', import.meta.url));
const record = (date, kg) => ({date, kg, updatedAt: '2026-11-15T12:00:00.000Z'});

test('measurement date labels refer to the actual calendar day across month/year and DST boundaries', () => {
  assert.equal(weightMeasurementDate('2026-11-16','2026-11-16'),'heute');
  assert.equal(weightMeasurementDate('2026-11-15','2026-11-16'),'gestern');
  assert.equal(weightMeasurementDate('2025-12-31','2026-01-01'),'gestern');
  assert.equal(weightMeasurementDate('2026-03-29','2026-03-30'),'gestern');
  assert.equal(weightMeasurementDate('2026-10-25','2026-10-26'),'gestern');
  assert.equal(weightMeasurementDate('2026-11-14','2026-11-16'),'14.11.2026');
  assert.equal(weightMeasurementDate('2026-11-17','2026-11-16'),'17.11.2026');
});

test('weight editing shows the preceding measurement without replacing the saved value', () => {
  const render=props=>renderToStaticMarkup(createElement(ToastProvider,null,createElement(WeightEntryForm,props)));
  const props={date:'2026-11-16',record:record('2026-11-16',72.8),suggestion:record('2026-11-15',72.4),onSave:async()=>{},onRemove:async()=>{},onClose:()=>{}};
  const html=render(props);
  assert.match(html,/Zuletzt <strong>72,4 kg<\/strong>/);assert.match(html,/dateTime="2026-11-15"/);assert.match(html,/value="72,8"/);
  const first=render({...props,suggestion:undefined});assert.match(first,/Noch keine frühere Messung vorhanden/);assert.match(first,/value="72,8"/);
  const newEntry=render({...props,record:undefined});assert.match(newEntry,/value="72,4"/);assert.match(newEntry,/Erst „Speichern“/);
});

test('German comma and decimal point inputs parse; malformed values are rejected', () => {
  assert.equal(parseWeight(' 72,55 '), 72.55);
  assert.equal(parseWeight('72.55'), 72.55);
  for (const input of ['', ' ', '72kg', '72,5,1', 'Infinity', '1e2', '-72']) assert.ok(Number.isNaN(parseWeight(input)));
});

test('weight validation rejects invalid dates, zero, non-finite numbers and invalid timestamps', () => {
  assert.equal(validWeight(record('2026-11-15', 72.5)), true);
  for (const kg of [0, -1, NaN, Infinity, '72']) assert.equal(validWeight(record('2026-11-15', kg)), false);
  for (const date of ['2026-02-30', '2026-13-01', '2026-2-1', '']) assert.equal(validWeight(record(date, 72)), false);
  assert.equal(validWeight({...record('2026-11-15', 72), updatedAt: 'invalid'}), false);
});

test('comparisons use the previous measurement across missing days and exclude later dates', () => {
  const records = [record('2026-11-15', 72.3), record('2026-11-01', 73.2), record('2026-11-20', 74), record('2026-11-10', 72.6)];
  const result = weightComparison(records, '2026-11-15');
  assert.equal(result.previous.date, '2026-11-10');
  assert.equal(result.previousChange, -0.3);
  assert.equal(result.totalChange, -0.9);
  assert.equal(records[0].date, '2026-11-15');
  assert.equal(weightComparison(records, '2026-10-01').latest, undefined);
  assert.equal(weightComparison(records, '2026-11-01').previousChange, undefined);
});

test('30-day range includes exactly 30 calendar dates and crosses month boundaries', () => {
  const records = [record('2026-10-16', 74), record('2026-10-17', 73), record('2026-11-15', 72), record('2026-11-16', 71)];
  assert.deepEqual(weightsInRange(records, '2026-11-15', '30').map(r => r.date), ['2026-10-17', '2026-11-15']);
  assert.equal(weightsInRange(records, '2026-11-15', 'all').length, 3);
});

test('legacy backups retain existing weights while new backups must contain valid unique measurements', () => {
  assert.equal(backupWeights({version: 1}), undefined);
  assert.deepEqual(backupWeights({version: 2, weights: []}), []);
  assert.throws(() => backupWeights({version: 2}), /Gewichtsdaten/);
  const sample = record('2026-11-15', 72);
  assert.throws(() => backupWeights({version: 2, weights: [sample, sample]}), /Gewichtsdaten/);
  assert.throws(() => backupWeights({version: 2, weights: [record('2026-11-15', 0)]}), /Gewichtsdaten/);
});

test('chart handles no data, single measurements and a constant series without invalid SVG coordinates', () => {
  for (const records of [[], [record('2026-11-15', 72)], [record('2026-11-01', 72), record('2026-11-15', 72)]]) {
    const html = renderToStaticMarkup(createElement(WeightChart, {records, date: '2026-11-15'}));
    assert.doesNotMatch(html, /NaN|Infinity/);
    if (records.length) assert.match(html, /Gewichtsmessungen im gewählten Zeitraum/);
    else assert.match(html, /Noch keine Gewichtswerte/);
  }
});
