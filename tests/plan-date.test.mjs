import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test,{beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const planningDb=await loadTypeScript(new URL('../src/planningDb.ts',import.meta.url));
const food={id:'food',name:'Joghurt',brand:'',portionName:'1 Becher',portionGrams:150,kcal:100,protein:10,carbs:5,sugar:2,fat:3,fiber:null,createdAt:'2026-11-16T00:00:00Z'};
const plan={id:'plan',name:'Mein Frühstück',date:'2026-11-16',meal:'Eigene Mahlzeit',items:[{foodId:food.id,foodSnapshot:food,amount:2,unit:'portion',grams:300,note:'Mit Obst\nNach dem Training'}],createdAt:food.createdAt,status:'planned',entryIds:[]};
beforeEach(async()=>{const database=await db.dbPromise;await database.clear('plans');await database.clear('entries');await database.clear('shopping');await planningDb.savePlan(structuredClone(plan));});

test('rescheduling changes only the date and leaves destination plans and shopping untouched',async()=>{
  const other={...plan,id:'other',date:'2026-11-17',name:'Andere Planung'};await planningDb.savePlan(other);
  const shopping={items:[{id:'food',foodId:'food',name:'Joghurt',brand:'',grams:999,checked:true}],updatedAt:food.createdAt};await(await db.dbPromise).put('shopping',shopping,'current');
  const moved=await planningDb.reschedulePlan(plan.id,plan.date,'2026-11-17');assert.deepEqual(moved,{...plan,date:'2026-11-17'});
  const data=await planningDb.getPlanningData();assert.equal(data.plans.length,2);assert.deepEqual(data.plans.find(value=>value.id===other.id),other);assert.deepEqual(data.shopping,shopping);assert.deepEqual((await db.getBackup()).entries,[]);
});

test('moving across weeks updates indexed shopping selection without recreating the plan',async()=>{
  await planningDb.reschedulePlan(plan.id,plan.date,'2026-11-23');
  await assert.rejects(planningDb.shoppingFromPlanWeek('2026-11-16','2026-11-22',false),/mindestens ein Rezept/);
  await planningDb.shoppingFromPlanWeek('2026-11-23','2026-11-29',false);const data=await planningDb.getPlanningData();assert.equal(data.shopping.items[0].grams,300);assert.equal(data.plans[0].id,plan.id);
});

test('invalid, unchanged, deleted and stale source dates never partially write',async()=>{
  for(const date of ['','bad','2026-02-30'])await assert.rejects(planningDb.reschedulePlan(plan.id,plan.date,date),/gültiges Zieldatum/);
  await assert.rejects(planningDb.reschedulePlan(plan.id,plan.date,plan.date),/anderen Tag/);
  await planningDb.reschedulePlan(plan.id,plan.date,'2026-11-17');await assert.rejects(planningDb.reschedulePlan(plan.id,plan.date,'2026-11-18'),/inzwischen verschoben/);assert.equal((await planningDb.getPlanningData()).plans[0].date,'2026-11-17');
  await planningDb.removePlanningRecord('plans',plan.id);await assert.rejects(planningDb.reschedulePlan(plan.id,plan.date,'2026-11-18'),/nicht mehr vorhanden/);
});

test('latest quantities and notes are preserved when only the date is changed',async()=>{
  const updated={...plan,name:'Neuer Name',items:[{...plan.items[0],grams:450,amount:3,note:'Neuere Notiz'}]};await planningDb.savePlan(updated);
  assert.deepEqual(await planningDb.reschedulePlan(plan.id,plan.date,'2026-11-20'),{...updated,date:'2026-11-20'});
});

test('logging and rescheduling serialize; logged plans and actual diary dates cannot be moved',async()=>{
  const results=await Promise.allSettled([planningDb.reschedulePlan(plan.id,plan.date,'2026-11-17'),planningDb.logPlan(plan.id)]);assert.equal(results[1].status,'fulfilled');
  const stored=(await planningDb.getPlanningData()).plans[0];assert.equal(stored.status,'logged');const entries=(await db.getBackup()).entries;assert.equal(entries.length,1);assert.equal(entries[0].date,stored.date);assert.deepEqual(entries[0].foodSnapshot,food);assert.equal(entries[0].note,plan.items[0].note);
  await assert.rejects(planningDb.reschedulePlan(plan.id,stored.date,'2026-11-18'),/bereits ins Tagebuch/);assert.deepEqual((await db.getBackup()).entries,entries);
});

test('write failures retain the original plan; rescheduled records survive a JSON backup',async()=>{
  const put=IDBObjectStore.prototype.put;
  try{IDBObjectStore.prototype.put=function(...args){if(this.name==='plans')throw new DOMException('Test failure','QuotaExceededError');return put.apply(this,args);};await assert.rejects(planningDb.reschedulePlan(plan.id,plan.date,'2026-11-17'),{name:'QuotaExceededError'});}finally{IDBObjectStore.prototype.put=put;}
  assert.deepEqual((await planningDb.getPlanningData()).plans[0],plan);
  const moved=await planningDb.reschedulePlan(plan.id,plan.date,'2026-11-23');const backup=JSON.parse(JSON.stringify(await db.getBackup()));await db.restoreBackup(backup);assert.deepEqual((await planningDb.getPlanningData()).plans[0],moved);
});
