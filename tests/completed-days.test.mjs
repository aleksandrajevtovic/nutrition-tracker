import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';

const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const {summarizeWeek} = await loadTypeScript(new URL('../src/week.ts', import.meta.url));
const {backupCompletedDays} = await loadTypeScript(new URL('../src/completedDays.ts', import.meta.url));
const food = {id:'food',name:'Test',brand:'',kcal:200,protein:20,carbs:10,fat:10,fiber:2,sugar:1,portionName:'1 Portion',portionGrams:100,createdAt:'2026-11-17T00:00:00Z'};
const entry = (date,grams,fiber=2) => ({id:date,foodId:food.id,foodSnapshot:{...food,fiber},date,meal:'Frühstück',grams,amount:grams,unit:'g',createdAt:food.createdAt});

test('completed-only averages filter nutrients and both comparison weeks without changing day totals, water or weights', () => {
  const entries=[entry('2026-11-09',100),entry('2026-11-10',10,null),entry('2026-11-02',200),entry('2026-11-03',25)];
  const weights=[{date:'2026-11-10',kg:72.4,updatedAt:food.createdAt}];
  const drinks=[{id:'water',date:'2026-11-10',time:'10:00',name:'Wasser',ml:250,createdAt:food.createdAt}];
  const options={completedDays:['2026-11-02','2026-11-09','2026-11-11'],onlyCompleted:true};
  const full=summarizeWeek(entries,weights,'2026-11-15',drinks);
  const filtered=summarizeWeek(entries,weights,'2026-11-15',drinks,options);
  assert.equal(full.averages.kcal,110);assert.equal(full.fiberIncomplete,true);
  assert.equal(filtered.averages.kcal,200);assert.equal(filtered.averages.protein,20);assert.equal(filtered.fiberIncomplete,false);
  assert.equal(filtered.recordedDays,2);assert.equal(filtered.averagedDays,1);
  assert.equal(filtered.days[0].completed,true);assert.equal(filtered.days[1].completed,false);assert.equal(filtered.days[2].completed,true);
  assert.deepEqual(filtered.totals,full.totals);assert.equal(filtered.days[1].totals.kcal,20);
  assert.equal(filtered.weightAverage,72.4);assert.equal(filtered.drinkAverageMl,250);
  const previous=summarizeWeek(entries,weights,'2026-11-08',drinks,options);
  assert.equal(previous.averages.kcal,400);assert.equal(previous.averagedDays,1);
  assert.equal(filtered.averages.kcal-previous.averages.kcal,-200);
});

test('empty, unmarked and incomplete days never invent zero averages; explicitly recorded zeros remain valid', () => {
  const entries=[entry('2026-11-09',100,null)];
  const empty=summarizeWeek(entries,[],'2026-11-15',[],{completedDays:['2026-11-10'],onlyCompleted:true});
  assert.equal(empty.averages,undefined);assert.equal(empty.averagedDays,0);assert.equal(empty.fiberIncomplete,false);
  const selected=summarizeWeek(entries,[],'2026-11-15',[],{completedDays:['2026-11-09'],onlyCompleted:true});
  assert.equal(selected.fiberIncomplete,true);assert.equal(selected.averages.kcal,200);
  const zero=entry('2026-11-09',100);zero.foodSnapshot.kcal=0;
  assert.equal(summarizeWeek([zero],[],'2026-11-15',[],{completedDays:[zero.date],onlyCompleted:true}).averages.kcal,0);
});

test('completion writes are atomic across dates, reversible and do not modify entries; period boundaries are inclusive', async () => {
  await db.saveEntry(entry('2026-11-09',100));
  const before=(await db.getBackup()).entries;
  await Promise.all(['2026-11-08','2026-11-09','2026-11-15','2026-11-16'].map(date=>db.setDayCompleted(date,true)));
  assert.equal((await db.getCompletedDays()).length,4);
  assert.deepEqual((await db.getPeriodData('2026-11-09','2026-11-15')).completedDays,['2026-11-09','2026-11-15']);
  await db.setDayCompleted('2026-11-09',true);assert.equal((await db.getCompletedDays()).length,4);
  await db.setDayCompleted('2026-11-09',false);assert.equal((await db.getCompletedDays()).includes('2026-11-09'),false);
  await db.setDayCompleted('2026-11-09',true);
  assert.deepEqual((await db.getBackup()).entries,before);
  await assert.rejects(db.setDayCompleted('2026-02-30',true),/Tagesstatus/);
  await assert.rejects(db.setDayCompleted('2026-11-09','true'),/Tagesstatus/);
});

test('backup round trips preserve marks; absent fields preserve local marks and an explicit empty list clears them', async () => {
  const backup=JSON.parse(JSON.stringify(await db.getBackup()));
  await db.setDayCompleted('2026-11-09',false);await db.restoreBackup(backup);
  assert.deepEqual(await db.getCompletedDays(),backup.completedDays);
  const legacy={...backup};delete legacy.completedDays;
  await db.restoreBackup(legacy);assert.deepEqual(await db.getCompletedDays(),backup.completedDays);
  for (const bad of [null,{},['2026-02-30'],['2026-11-09','2026-11-09'],[1]]) {
    await assert.rejects(db.restoreBackup({...backup,completedDays:bad}),/vollständig/);
    assert.deepEqual(await db.getCompletedDays(),backup.completedDays);
    assert.deepEqual((await db.getBackup()).entries,backup.entries);
  }
  assert.equal(backupCompletedDays({}),undefined);
  await db.restoreBackup({...backup,completedDays:[]});assert.deepEqual(await db.getCompletedDays(),[]);
});
