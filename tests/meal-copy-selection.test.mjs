import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test,{beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const {mealCopyAmount}=await loadTypeScript(new URL('../src/mealCopy.ts',import.meta.url));
const {toGrams}=await loadTypeScript(new URL('../src/nutrition.ts',import.meta.url));
const {germanError}=await loadTypeScript(new URL('../src/german.ts',import.meta.url));
const food={id:'food',name:'Joghurt',brand:'Bio',kcal:100,protein:10,carbs:10,sugar:2,fat:1,fiber:null,portionName:'Klein',portionGrams:80,gramsPerMl:0.92,pieceGrams:100,sliceGrams:30,createdAt:'2026-11-18T00:00:00Z'};
const entry=(id,unit='portion',amount=2)=>({id,foodId:food.id,foodSnapshot:structuredClone(food),date:'2026-11-18',meal:'Frühstück',amount,unit,grams:toGrams(food,amount,unit),note:`Notiz ${id}\nMit Kräutern.`,createdAt:`2026-11-18T0${id==='a'?1:2}:00:00Z`});
const source=[entry('a'),entry('b','ml',100)],target={...entry('existing','g',50),date:'2026-11-19',meal:'Mittagessen'};
beforeEach(async()=>{await(await db.dbPromise).clear('entries');for(const item of [...source,target])await db.saveEntry(structuredClone(item));});

test('selective meal copy skips unchecked entries and preserves source, target, notes and frozen nutrients with changed amounts',async()=>{
  await db.saveFood({...food,kcal:999,portionGrams:250});const copies=await db.copyMealEntries(source[0].date,'Frühstück',target.date,target.meal,[{source:source[0],amount:0.5}]);
  assert.equal(copies.length,1);assert.equal(copies[0].amount,0.5);assert.equal(copies[0].grams,40);assert.equal(copies[0].unit,'portion');assert.equal(copies[0].note,source[0].note);assert.deepEqual(copies[0].foodSnapshot,food);assert.notEqual(copies[0].id,source[0].id);assert.notEqual(copies[0].createdAt,source[0].createdAt);
  assert.deepEqual(await db.listEntries(source[0].date),source);assert.deepEqual((await db.listEntries(target.date)).find(item=>item.id===target.id),target);assert.equal((await db.listEntries(target.date)).length,2);
});

test('every unit uses its historical conversion and legacy records stay gram-only unless their amount changes',()=>{
  for(const unit of ['g','mg','kg','ml','l','portion','piece','slice']){const original=entry('a',unit,2),before=structuredClone(original),copy=mealCopyAmount(original,0.5);assert.equal(copy.grams,toGrams(food,0.5,unit));assert.equal(copy.unit,unit);assert.equal(copy.note,original.note);assert.deepEqual(original,before);}
  const {amount,unit,...legacy}=entry('a','g',150);assert.deepEqual(mealCopyAmount(legacy,150),legacy);assert.deepEqual(mealCopyAmount(legacy,75),{...legacy,amount:75,unit:'g',grams:75});
});

test('empty, duplicate, invalid and wrong-source selections do not write any copies',async()=>{
  const before=(await db.getBackup()).entries;
  for(const selection of [[],[{source:source[0],amount:2},{source:source[0],amount:1}],...[0,-1,NaN,Infinity].map(amount=>[{source:source[0],amount}]),[{source:target,amount:1}]]){
    await assert.rejects(db.copyMealEntries(source[0].date,'Frühstück',target.date,target.meal,selection));assert.deepEqual((await db.getBackup()).entries,before);
  }
});

test('a selected entry changed or deleted after opening rejects the whole operation; an unselected change does not block copying',async()=>{
  const selection=source.map(item=>({source:item,amount:1}));await db.saveEntry({...source[1],note:'Neuere Notiz'});let before=(await db.getBackup()).entries;
  await assert.rejects(db.copyMealEntries(source[0].date,'Frühstück',target.date,target.meal,selection),error=>{assert.match(error.message,/erneut öffnen/);assert.equal(germanError(error),error.message);return true;});assert.deepEqual((await db.getBackup()).entries,before);
  await db.removeEntry(source[1].id);before=(await db.getBackup()).entries;await assert.rejects(db.copyMealEntries(source[0].date,'Frühstück',target.date,target.meal,selection),/erneut öffnen/);assert.deepEqual((await db.getBackup()).entries,before);
  const copied=await db.copyMealEntries(source[0].date,'Frühstück',target.date,target.meal,[selection[0]]);assert.equal(copied.length,1);
});

test('copying into the same meal remains additive and retains original entry order regardless of selection order',async()=>{
  const copied=await db.copyMealEntries(source[0].date,'Frühstück',source[0].date,'Frühstück',[{source:source[1],amount:100},{source:source[0],amount:2}]);assert.equal(copied.length,2);assert.equal(copied[0].note,source[0].note);assert.equal(copied[1].note,source[1].note);assert.equal(new Set(copied.map(item=>item.id)).size,2);assert.equal((await db.listEntries(source[0].date)).length,4);
});

test('failed insertion rolls back the complete selected batch and leaves originals and targets unchanged',async()=>{
  const originalAdd=IDBObjectStore.prototype.add,before=(await db.getBackup()).entries;let count=0;
  IDBObjectStore.prototype.add=function(...args){if(this.name==='entries'&&++count===2)throw new DOMException('Failure','QuotaExceededError');return originalAdd.apply(this,args);};
  try {await assert.rejects(db.copyMealEntries(source[0].date,'Frühstück',target.date,target.meal,source.map(item=>({source:item,amount:1}))));assert.deepEqual((await db.getBackup()).entries,before);}
  finally {IDBObjectStore.prototype.add=originalAdd;}
});
