import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/german.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext}});
const {germanFood, germanEntry, germanError} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('existing food labels are translated without changing stored nutrients or portions', () => {
  const original = {id: 'bread', name: 'Hleb', brand: 'Generička procena', portionName: '1 kriška', portionGrams: 40, kcal: 250};
  assert.deepEqual(germanFood(original), {...original, name: 'Brot', brand: 'Allgemeiner Schätzwert', portionName: '1 Scheibe'});
  assert.equal(original.name, 'Hleb');
});

test('historical diary snapshots and meal names are translated while amounts remain unchanged', () => {
  const original = {id: 'entry', meal: 'Doručak', grams: 80, amount: 2, unit: 'slice', foodSnapshot: {name: 'Hleb', brand: '', portionName: '1 kriška', kcal: 250}};
  const translated = germanEntry(original);
  assert.equal(translated.meal, 'Frühstück');
  assert.equal(translated.foodSnapshot.name, 'Brot');
  assert.equal(translated.foodSnapshot.kcal, 250);
  assert.equal(translated.grams, 80);
  assert.equal(translated.amount, 2);
  assert.equal(translated.unit, 'slice');
  assert.deepEqual(germanEntry(translated), translated);
});

test('custom food names, brands and portions stay intact', () => {
  const food = {name: 'Mein Lachs', brand: 'Meine Marke', portionName: '1 Filet'};
  assert.deepEqual(germanFood(food), food);
});

test('native parse and storage errors are presented in German', () => {
  assert.equal(germanError(new SyntaxError('Unexpected token')), 'Die Datei enthält keine gültigen JSON-Daten.');
  assert.match(germanError(new DOMException('Access denied', 'SecurityError')), /^Der Browser erlaubt/);
  assert.equal(germanError(new Error('Ungültige Produktdaten')), 'Ungültige Produktdaten');
});
