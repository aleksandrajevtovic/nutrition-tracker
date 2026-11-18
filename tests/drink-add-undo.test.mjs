import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test,{beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const {createDrink}=await loadTypeScript(new URL('../src/hydration.ts',import.meta.url));
const drink={id:'water',date:'2026-11-18',time:'12:00',name:'Wasser',ml:250,createdAt:'2026-11-18T11:00:00Z'};
beforeEach(async()=>{await(await db.dbPromise).clear('drinks');});

test('undo removes exactly one of two identical quick additions and retains other days',async()=>{
  const revision=db.getDataRevision(),duplicate={...drink,id:'duplicate'},other={...drink,id:'other-day',date:'2026-11-17',name:'Tee',ml:400};
  await db.saveDrink(drink);await db.saveDrink(duplicate);await db.saveDrink(other);
  await db.undoAddedDrink(duplicate,revision);assert.deepEqual(await db.listDrinks(drink.date),[drink]);assert.deepEqual(await db.listDrinks(other.date),[other]);
  await db.undoAddedDrink(drink,revision);assert.deepEqual(await db.listDrinks(drink.date),[]);
});

test('custom litre amounts can be undone without modifying neighbouring drinks',async()=>{
  const revision=db.getDataRevision(),custom=createDrink(drink.date,'Saft','1,25','l','13:15');await db.saveDrink(drink);await db.saveDrink(custom);assert.equal(custom.ml,1250);
  await db.undoAddedDrink(custom,revision);assert.deepEqual(await db.listDrinks(drink.date),[drink]);
});

test('newer quantity, name, time or date edits and deletion are protected from stale undo',async()=>{
  const revision=db.getDataRevision();
  for(const changed of [{...drink,ml:500},{...drink,name:'Tee'},{...drink,time:'13:00'},{...drink,date:'2026-11-19'}]){
    await db.saveDrink(changed);await assert.rejects(db.undoAddedDrink(drink,revision),/inzwischen geändert oder gelöscht/);assert.deepEqual((await db.getBackup()).drinks,[changed]);await db.removeDrink(drink.id);
  }
  await assert.rejects(db.undoAddedDrink(drink,revision),/inzwischen geändert oder gelöscht/);assert.deepEqual((await db.getBackup()).drinks,[]);
});

test('property order does not affect matching and an already undone addition cannot remove another drink',async()=>{
  const revision=db.getDataRevision(),reordered=Object.fromEntries(Object.entries(drink).reverse());await db.saveDrink(reordered);await db.saveDrink({...drink,id:'other'});await db.undoAddedDrink(drink,revision);
  await assert.rejects(db.undoAddedDrink(drink,revision),/inzwischen geändert oder gelöscht/);assert.equal((await db.listDrinks(drink.date)).length,1);assert.equal((await db.listDrinks(drink.date))[0].id,'other');
});

test('imports invalidate an old undo even if the imported drink is identical; invalid input leaves data intact',async()=>{
  await db.saveDrink(drink);const revision=db.getDataRevision();await db.restoreBackup(await db.getBackup());await assert.rejects(db.undoAddedDrink(drink,revision),/Datenimport/);assert.deepEqual(await db.listDrinks(drink.date),[drink]);
  await assert.rejects(db.undoAddedDrink({...drink,ml:0},db.getDataRevision()),/Trinkdaten/);assert.deepEqual(await db.listDrinks(drink.date),[drink]);
});

test('failed deletion preserves the drink and leaves the undo available for retry',async()=>{
  await db.saveDrink(drink);const revision=db.getDataRevision(),originalDelete=IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete=function(key){if(this.name==='drinks')throw new DOMException('Failure','QuotaExceededError');return originalDelete.call(this,key);};
  try {await assert.rejects(db.undoAddedDrink(drink,revision));assert.deepEqual(await db.listDrinks(drink.date),[drink]);}finally{IDBObjectStore.prototype.delete=originalDelete;}
  await db.undoAddedDrink(drink,revision);assert.deepEqual(await db.listDrinks(drink.date),[]);
});
