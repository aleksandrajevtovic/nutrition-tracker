import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test,{beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const {saveEntryWithUndo,changeEntryAmountWithUndo,undoEntryEdit}=await loadTypeScript(new URL('../src/entryEdits.ts',import.meta.url));
const food={id:'food',name:'Kartoffel',brand:'Bio',kcal:77,protein:2,carbs:17,sugar:1,fat:0.1,fiber:null,portionName:'Klein',portionGrams:80,gramsPerMl:0.92,createdAt:'2026-11-17T00:00:00Z'};
const original={id:'entry',foodId:food.id,foodSnapshot:structuredClone(food),date:'2026-11-17',meal:'Frühstück',grams:160,amount:2,unit:'portion',note:'Originalnotiz\nZweite Zeile',createdAt:food.createdAt};
const current=async()=> (await db.getBackup()).entries.find(entry=>entry.id===original.id);
beforeEach(async()=>{await(await db.dbPromise).clear('entries');await db.saveEntry(structuredClone(original));});

test('editing restores the complete previous entry and historical nutrient snapshot without changing its product',async()=>{
  await db.saveFood({...food,kcal:999,portionGrams:100});
  const result=await saveEntryWithUndo({...original,amount:0.5,grams:40,meal:'Abendessen',note:'Neue Notiz',foodSnapshot:{...food,kcal:90}});
  assert.deepEqual(result.change.before,original);assert.equal((await current()).grams,40);await undoEntryEdit(result.change);
  assert.deepEqual(await current(),original);assert.equal((await db.listFoods())[0].kcal,999);
});

test('quantity undo captures the actual stored note and supports original units and legacy gram-only entries',async()=>{
  const newer={...original,note:'Neuere gespeicherte Notiz'};await db.saveEntry(newer);
  const result=await changeEntryAmountWithUndo(original.id,3);assert.equal(result.entry.grams,240);assert.equal(result.entry.note,newer.note);await undoEntryEdit(result.change);assert.deepEqual(await current(),newer);
  const {amount,unit,...legacy}=original;await db.saveEntry(legacy);const changed=await changeEntryAmountWithUndo(original.id,15);assert.equal(changed.entry.unit,'g');assert.equal(changed.entry.grams,15);await undoEntryEdit(changed.change);assert.deepEqual(await current(),legacy);
});

test('new entries and exact no-op saves have no edit undo; invalid amounts never partially write',async()=>{
  assert.equal((await saveEntryWithUndo(original)).change,undefined);assert.equal((await changeEntryAmountWithUndo(original.id,2)).change,undefined);
  assert.equal((await saveEntryWithUndo({...original,id:'new'})).change,undefined);
  for(const amount of [0,-1,NaN,Infinity])await assert.rejects(changeEntryAmountWithUndo(original.id,amount),/Menge/);
  await assert.rejects(changeEntryAmountWithUndo('missing',2),/nicht mehr vorhanden/);assert.deepEqual(await current(),original);
});

test('undo refuses later edits, moves and deletion instead of overwriting newer data',async()=>{
  const first=await changeEntryAmountWithUndo(original.id,3);
  const newer={...first.entry,note:'Später geändert'};await db.saveEntry(newer);await assert.rejects(undoEntryEdit(first.change),/neueren Datensatz/);assert.deepEqual(await current(),newer);
  const moved={...first.entry,date:'2026-11-18'};await db.saveEntry(moved);await assert.rejects(undoEntryEdit(first.change),/neueren Datensatz/);assert.deepEqual(await current(),moved);
  await db.removeEntry(original.id);await assert.rejects(undoEntryEdit(first.change),/neueren Datensatz/);assert.equal(await current(),undefined);
});

test('identical values with different property order can be undone; concurrent changes capture atomic before states',async()=>{
  const [first,second]=await Promise.all([changeEntryAmountWithUndo(original.id,3),changeEntryAmountWithUndo(original.id,4)]);
  assert.equal(second.change.before.amount,3);await assert.rejects(undoEntryEdit(first.change),/neueren Datensatz/);
  const reordered=Object.fromEntries(Object.entries(second.entry).reverse());reordered.foodSnapshot=Object.fromEntries(Object.entries(reordered.foodSnapshot).reverse());await db.saveEntry(reordered);
  await undoEntryEdit(second.change);assert.equal((await current()).amount,3);await undoEntryEdit(first.change);assert.deepEqual(await current(),original);
});

test('an import invalidates undo even if the imported entry matches the just-saved state',async()=>{
  const result=await changeEntryAmountWithUndo(original.id,3),backup=await db.getBackup();await db.restoreBackup(backup);
  await assert.rejects(undoEntryEdit(result.change),/Datenimport/);assert.deepEqual(await current(),result.entry);
});
