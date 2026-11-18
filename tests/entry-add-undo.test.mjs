import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test, {beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const {saveEntryWithUndo, undoEntryAddition} = await loadTypeScript(new URL('../src/entryEdits.ts', import.meta.url));
const food = {id:'food',name:'Joghurt',brand:'Bio',kcal:60,protein:4,carbs:5,sugar:4,fat:2,fiber:null,portionName:'1 Becher',portionGrams:150,createdAt:'2026-11-18T12:00:00Z'};
const entry = {id:'entry',foodId:food.id,foodSnapshot:structuredClone(food),date:'2026-11-18',meal:'Frühstück',grams:300,amount:2,unit:'portion',note:'Mit Obst',createdAt:food.createdAt};
const read = async () => (await db.getBackup()).entries;
beforeEach(async () => {await (await db.dbPromise).clear('entries');});

test('addition undo removes exactly one duplicate and preserves products, notes and other days', async () => {
  await db.saveFood(food);
  const first = await saveEntryWithUndo(entry);
  const duplicate = await saveEntryWithUndo({...entry,id:'duplicate'});
  const other = {...entry,id:'other',date:'2026-11-17'};await db.saveEntry(other);
  assert.deepEqual(first.addition.entry,entry);assert.equal(first.change,undefined);
  await undoEntryAddition(duplicate.addition);
  assert.deepEqual((await read()).sort((a,b)=>a.id.localeCompare(b.id)),[entry,other]);
  assert.deepEqual((await db.listFoods()).find(item=>item.id===food.id),food);
  await undoEntryAddition(first.addition);assert.deepEqual(await read(),[other]);
});

test('edits and unchanged saves do not get addition undo; tokens are independent snapshots', async () => {
  const result = await saveEntryWithUndo(structuredClone(entry));
  result.entry.note = 'Only mutate returned value';assert.deepEqual(result.addition.entry,entry);
  assert.equal((await saveEntryWithUndo(entry)).addition,undefined);
  const edited = await saveEntryWithUndo({...entry,note:'Changed'});
  assert.equal(edited.addition,undefined);assert.deepEqual(edited.change.before,entry);
});

test('addition undo protects subsequent quantity, note, snapshot and destination changes', async () => {
  for (const changes of [{amount:1,grams:150},{note:'New note'},{foodSnapshot:{...food,kcal:99}},{meal:'Abendessen'},{date:'2026-11-19'}]) {
    await (await db.dbPromise).clear('entries');
    const result = await saveEntryWithUndo(entry), newer = {...entry,...changes};await db.saveEntry(newer);
    await assert.rejects(undoEntryAddition(result.addition),/neueren Datensatz/);assert.deepEqual(await read(),[newer]);
  }
});

test('matching ignores property order; repeated undo cannot remove another entry', async () => {
  const result = await saveEntryWithUndo(entry);
  const reordered = Object.fromEntries(Object.entries(entry).reverse());
  reordered.foodSnapshot = Object.fromEntries(Object.entries(food).reverse());await db.saveEntry(reordered);
  const other = {...entry,id:'other'};await db.saveEntry(other);
  await undoEntryAddition(result.addition);
  await assert.rejects(undoEntryAddition(result.addition),/neueren Datensatz/);assert.deepEqual(await read(),[other]);
});

test('import invalidates addition undo even when the imported entry is identical', async () => {
  const result = await saveEntryWithUndo(entry);await db.restoreBackup(await db.getBackup());
  await assert.rejects(undoEntryAddition(result.addition),/Datenimport/);assert.deepEqual(await read(),[entry]);
});

test('failed undo retains the entry and can be retried', async () => {
  const result = await saveEntryWithUndo(entry), originalDelete = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete = function(key) {if(this.name==='entries')throw new DOMException('Failure','QuotaExceededError');return originalDelete.call(this,key);};
  try {await assert.rejects(undoEntryAddition(result.addition));assert.deepEqual(await read(),[entry]);}
  finally {IDBObjectStore.prototype.delete = originalDelete;}
  await undoEntryAddition(result.addition);assert.deepEqual(await read(),[]);
});
