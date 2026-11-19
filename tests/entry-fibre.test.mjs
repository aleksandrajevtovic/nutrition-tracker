import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test, {beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const load = name => loadTypeScript(new URL(`../src/${name}.ts`,import.meta.url));
const db = await load('db');
const {stats,fiberIncomplete} = await load('nutrition');
const {nutrientCoverage} = await load('nutrientCoverage');
const {dailyCsv} = await load('csv');
const {saveEntryWithUndo,undoEntryEdit} = await load('entryEdits');
const {withEntryAmount} = await load('entryQuantity');
const {buildRecipeFood,validRecipeFood} = await load('recipes');
const food = {id:'food',name:'Joghurt',brand:'',kcal:60,protein:4,carbs:5,sugar:4,fat:2,fiber:null,portionName:'1 Portion',portionGrams:100,createdAt:'2026-11-19T00:00:00Z'};
const entry = {id:'entry',foodId:food.id,foodSnapshot:food,date:'2026-11-19',meal:'Frühstück',amount:150,unit:'g',grams:150,createdAt:food.createdAt};
beforeEach(async()=>{const database=await db.dbPromise;await database.clear('entries');await database.clear('foods');});

test('supplementing fibre updates only the diary snapshot, scales with amount and supports undo',async()=>{
  await db.saveFood(food);await db.saveEntry(entry);const result=await saveEntryWithUndo({...entry,foodSnapshot:{...food,entryFiber:0.8}});
  assert.ok(Math.abs(stats(result.entry.foodSnapshot,150).fiber-1.2)<1e-9);assert.equal(fiberIncomplete([result.entry]),false);assert.deepEqual(nutrientCoverage([result.entry],'fiber'),{missing:false,hasKnown:true});assert.equal((await db.listFoods())[0].fiber,null);
  const scaled=withEntryAmount(result.entry,300);assert.ok(Math.abs(stats(scaled.foodSnapshot,scaled.grams).fiber-2.4)<1e-9);await undoEntryEdit(result.change);assert.deepEqual(await db.listEntries(entry.date),[entry]);
});
test('known zero is complete and exported as zero, without replacing original product data',async()=>{
  const supplemented={...entry,foodSnapshot:{...food,entryFiber:0}};await db.saveEntry(supplemented);const backup=await db.getBackup();await db.restoreBackup(backup);assert.deepEqual(await db.listEntries(entry.date),[supplemented]);assert.equal(fiberIncomplete([supplemented]),false);
  assert.equal(dailyCsv([supplemented],[]).csv.split('\r\n')[1].split(';')[6],'0');assert.equal(dailyCsv([entry],[]).csv.split('\r\n')[1].split(';')[6],'');await assert.rejects(db.saveFood(supplemented.foodSnapshot),/Produktdaten/);
});
test('a recipe supplement keeps its ingredient snapshots and remains compatible with backups',async()=>{
  const recipe=buildRecipeFood({...food,id:'recipe',name:'Rezept'},{servings:1,yieldGrams:100,autoWeight:true,instructions:'Rühren',ingredients:[{id:'ingredient',amount:100,unit:'g',grams:100,foodSnapshot:food}]});
  await db.saveFood(recipe);const supplemented={...entry,foodId:recipe.id,foodSnapshot:{...recipe,entryFiber:2}};assert.equal(validRecipeFood(supplemented.foodSnapshot),true);await db.saveEntry(supplemented);await db.restoreBackup(await db.getBackup());
  assert.deepEqual((await db.listEntries(entry.date))[0].foodSnapshot.recipe,recipe.recipe);assert.deepEqual(await db.listFoods(),[recipe]);assert.equal(stats(supplemented.foodSnapshot,150).fiber,3);
});
test('invalid supplements never overwrite an existing entry',async()=>{
  await db.saveEntry(entry);for(const entryFiber of [-1,NaN,Infinity])await assert.rejects(saveEntryWithUndo({...entry,foodSnapshot:{...food,entryFiber}}));assert.deepEqual(await db.listEntries(entry.date),[entry]);
});
