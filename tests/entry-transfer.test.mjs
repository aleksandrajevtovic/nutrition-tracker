import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test,{beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const {transferEntry,undoEntryTransfer}=await loadTypeScript(new URL('../src/entryTransfer.ts',import.meta.url));
const food={id:'removed-product',name:'Kartoffel',brand:'',portionName:'Klein',portionGrams:80,kcal:77,protein:2,carbs:17,sugar:1,fat:0.1,fiber:null,createdAt:'2026-11-16T00:00:00Z'};
const source={id:'source',foodId:food.id,foodSnapshot:food,date:'2026-11-16',meal:'Frühstück',grams:160,amount:2,unit:'portion',note:'Mit Kräutern\nNach dem Training',createdAt:food.createdAt};
beforeEach(async()=>{await(await db.dbPromise).clear('entries');await db.saveEntry(structuredClone(source));});

test('copy keeps the original and creates a fresh entry with exact quantity, note and historical snapshot even without the product',async()=>{
  const result=await transferEntry(source,'2026-11-17','Mittagessen','copy');
  assert.notEqual(result.after.id,source.id);assert.notEqual(result.after.createdAt,source.createdAt);
  assert.deepEqual((await db.listEntries(source.date))[0],source);assert.deepEqual(result.after.foodSnapshot,source.foodSnapshot);assert.equal(result.after.note,source.note);assert.equal(result.after.grams,160);assert.equal(result.after.amount,2);assert.equal(result.after.unit,'portion');
  assert.deepEqual((await db.listEntries('2026-11-17'))[0],result.after);assert.deepEqual(await db.listFoods(),[]);
  await undoEntryTransfer(result);assert.deepEqual(await db.listEntries('2026-11-17'),[]);assert.deepEqual((await db.listEntries(source.date))[0],source);
});

test('move changes only destination and never overwrites entries already present at the target',async()=>{
  const target={...source,id:'target',date:'2026-11-17',meal:'Eigene Mahlzeit',note:'Unverändert'};await db.saveEntry(target);
  const result=await transferEntry(source,'2026-11-17','Eigene Mahlzeit','move');
  assert.deepEqual(result.after,{...source,date:'2026-11-17',meal:'Eigene Mahlzeit'});assert.deepEqual(await db.listEntries(source.date),[]);assert.equal((await db.listEntries('2026-11-17')).length,2);
  await undoEntryTransfer(result);assert.deepEqual((await db.listEntries(source.date))[0],source);assert.deepEqual(await db.listEntries(target.date),[target]);
});

test('same-day meal moves, exact same-target copies and legacy gram-only entries remain valid',async()=>{
  await assert.rejects(transferEntry(source,source.date,source.meal,'move'),/anderes Zieldatum/);
  const moved=await transferEntry(source,source.date,'Abendessen','move');assert.equal(moved.after.id,source.id);await undoEntryTransfer(moved);
  const copied=await transferEntry(source,source.date,source.meal,'copy');assert.equal((await db.listEntries(source.date)).length,2);await undoEntryTransfer(copied);
  const {amount,unit,...legacy}=source;await db.saveEntry(legacy);const result=await transferEntry(legacy,'2026-11-18','Sonstiges','copy');assert.equal(result.after.amount,undefined);assert.equal(result.after.unit,undefined);assert.equal(result.after.grams,160);
});

test('invalid targets, changed or deleted sources do not partially write or silently use stale values',async()=>{
  await assert.rejects(transferEntry(source,'bad','Mittagessen','copy'),/gültiges Zieldatum/);
  await assert.rejects(transferEntry(source,'2026-11-17',' ','move'),/gültiges Zieldatum/);
  await db.saveEntry({...source,note:'Neuere Notiz'});await assert.rejects(transferEntry(source,'2026-11-17','Mittagessen','copy'),/inzwischen geändert/);assert.equal((await db.listEntries(source.date))[0].note,'Neuere Notiz');assert.deepEqual(await db.listEntries('2026-11-17'),[]);
  await db.removeEntry(source.id);await assert.rejects(transferEntry(source,'2026-11-17','Mittagessen','move'),/nicht mehr vorhanden/);
});

test('concurrent moves serialize and reject the second stale request',async()=>{
  const results=await Promise.allSettled([transferEntry(source,'2026-11-17','Mittagessen','move'),transferEntry(source,'2026-11-18','Abendessen','move')]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal((await db.getBackup()).entries.length,1);
});

test('undo refuses to overwrite later edits or a data import',async()=>{
  const result=await transferEntry(source,'2026-11-17','Mittagessen','move');await db.saveEntry({...result.after,note:'Später bearbeitet'});await assert.rejects(undoEntryTransfer(result),/neueren Datensatz/);assert.equal((await db.listEntries('2026-11-17'))[0].note,'Später bearbeitet');
  await db.saveEntry(source);const copy=await transferEntry(source,'2026-11-18','Mittagessen','copy');const backup=JSON.parse(JSON.stringify(await db.getBackup()));await db.restoreBackup(backup);await assert.rejects(undoEntryTransfer(copy),/Datenimport/);
});

test('source equality ignores object key order and copied/moved records survive backups unchanged',async()=>{
  const reordered=Object.fromEntries(Object.entries(source).reverse());const result=await transferEntry(reordered,'2026-11-17','Mittagessen','copy');const backup=JSON.parse(JSON.stringify(await db.getBackup()));await db.restoreBackup(backup);assert.deepEqual((await db.listEntries('2026-11-17'))[0],result.after);assert.deepEqual((await db.listEntries(source.date))[0],source);
});
