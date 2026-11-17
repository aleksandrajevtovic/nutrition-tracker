import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test,{beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const planning=await loadTypeScript(new URL('../src/planningDb.ts',import.meta.url));
const {itemFromFood}=await loadTypeScript(new URL('../src/planning.ts',import.meta.url));
const food={id:'banana',name:'Banane',brand:'Bio',kcal:89,protein:1,carbs:22,sugar:12,fat:0.3,fiber:null,portionName:'1 Portion',portionGrams:100,createdAt:'2026-11-17T00:00:00Z'};
const items=[{id:'apple',foodId:'apple',name:'Apfel',brand:'',grams:150,checked:false},{id:'banana',foodId:'banana',name:'Banane',brand:'Bio',grams:1500,checked:true},{id:'oil',foodId:'oil',name:'Öl',brand:'Marke A',grams:2.25,checked:false}];
const shopping=async()=> (await planning.getPlanningData()).shopping;
beforeEach(async()=>{const database=await db.dbPromise;await database.clear('shopping');await database.put('shopping',{items:structuredClone(items),updatedAt:food.createdAt},'current');});

test('removing and undoing open/purchased ingredients retains exact weight, brand and check status without touching other data',async()=>{
  for(const item of items){const removed=await planning.removeShoppingItem(item.id);assert.deepEqual(removed.item,item);assert.equal((await shopping()).items.some(value=>value.id===item.id),false);await planning.restoreShoppingItem(removed);assert.deepEqual((await shopping()).items,items);}
  assert.deepEqual((await db.getBackup()).entries,[]);assert.deepEqual((await db.getBackup()).foods,[]);
});

test('undo merges only the removed item and preserves later checks, additions and independent removals',async()=>{
  const banana=await planning.removeShoppingItem('banana');await planning.toggleShoppingItem('apple',true);await planning.setShoppingFromMeals([itemFromFood({...food,id:'pear',name:'Birne'},50,'g')],true);const oil=await planning.removeShoppingItem('oil');
  await planning.restoreShoppingItem(banana);let current=(await shopping()).items;assert.equal(current.find(value=>value.id==='apple').checked,true);assert.equal(current.find(value=>value.id==='pear').grams,50);assert.equal(current.some(value=>value.id==='oil'),false);assert.deepEqual(current.find(value=>value.id==='banana'),items[1]);
  await planning.restoreShoppingItem(oil);current=(await shopping()).items;assert.deepEqual(current.find(value=>value.id==='oil'),items[2]);assert.equal(current.length,4);
});

test('same item re-added or removed a second time cannot be overwritten by an older undo',async()=>{
  const first=await planning.removeShoppingItem('banana');await planning.setShoppingFromMeals([itemFromFood(food,200,'g')],true);await assert.rejects(planning.restoreShoppingItem(first),/neuere Menge/);assert.equal((await shopping()).items.find(value=>value.id==='banana').grams,200);
  const second=await planning.removeShoppingItem('banana');await assert.rejects(planning.restoreShoppingItem(first),/erneut geändert/);await planning.restoreShoppingItem(second);assert.equal((await shopping()).items.find(value=>value.id==='banana').grams,200);await assert.rejects(planning.restoreShoppingItem(second),/neuere Menge/);
});

test('clearing, replacing via recipes or plan week, and importing invalidate old item undo even if the list looks the same',async()=>{
  for(const replace of [()=>planning.clearShopping(),()=>planning.setShoppingFromMeals([itemFromFood(food,100,'g')],false),async()=>{await planning.savePlan({id:'plan',name:'Plan',date:'2026-11-17',meal:'Mittagessen',items:[itemFromFood(food,100,'g')],status:'planned',entryIds:[],createdAt:food.createdAt});await planning.shoppingFromPlanWeek('2026-11-16','2026-11-22',false);},async()=>db.restoreBackup(await db.getBackup())]){
    await(await db.dbPromise).put('shopping',{items:structuredClone(items),updatedAt:food.createdAt},'current');const removed=await planning.removeShoppingItem('apple');await replace();const before=await shopping();await assert.rejects(planning.restoreShoppingItem(removed),/ersetzt, geleert oder importiert/);assert.deepEqual(await shopping(),before);
  }
});

test('last-item removal can be undone, missing items fail harmlessly, and concurrent removals retain separate undo tokens',async()=>{
  const removed=await Promise.all(items.map(item=>planning.removeShoppingItem(item.id)));assert.deepEqual((await shopping()).items,[]);await assert.rejects(planning.removeShoppingItem('missing'),/nicht mehr vorhanden/);await Promise.all(removed.map(value=>planning.restoreShoppingItem(value)));assert.deepEqual((await shopping()).items,items);
});

test('failed persistence aborts item and undo metadata writes and leaves existing undo usable for retry',async()=>{
  const removed=await planning.removeShoppingItem('banana'),before=await shopping();
  const originalPut=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,key){if(this.name==='shopping'&&key==='current')throw new DOMException('Failure','QuotaExceededError');return originalPut.call(this,value,key);};
  try {await assert.rejects(planning.removeShoppingItem('apple'));await assert.rejects(planning.clearShopping());await assert.rejects(planning.setShoppingFromMeals([itemFromFood(food,100,'g')],false));await assert.rejects(planning.restoreShoppingItem(removed));assert.deepEqual(await shopping(),before);}
  finally {IDBObjectStore.prototype.put=originalPut;}
  await planning.restoreShoppingItem(removed);assert.deepEqual((await shopping()).items,items);
});
