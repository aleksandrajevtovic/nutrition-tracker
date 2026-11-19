import 'fake-indexeddb/auto';
import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './helpers/typescript.mjs';
const load = name => loadTypeScript(new URL(`../src/${name}.ts`, import.meta.url));
const {initialDirectDraft, directDraftErrors, buildDirectEntry, validDirectItem} = await load('directNutrition');
const {stats, nutrientAmount, validFood} = await load('nutrition');
const {withEntryAmount} = await load('entryQuantity');
const {entryQuantity} = await load('quantityLabels');
const {summarizeWeek} = await load('week');
const {dailyCsv, weeklyCsv} = await load('csv');
const {itemsFromEntries, scaleItems, itemsToEntries, mealTotals, shoppingFromMeals, mergeShopping, validShopping} = await load('planning');
const {shoppingListText} = await load('shoppingList');
const db = await load('db');
const {saveEntryWithUndo, undoEntryAddition, undoEntryEdit} = await load('entryEdits');
const draft = changes => ({...initialDirectDraft(null), name:'Brezel vom Bäcker', kcal:'275', ...changes});
const create = changes => buildDirectEntry(draft(changes), {id:'direct-entry', date:'2026-11-19', meal:'Frühstück', note:'Vom Bäcker', original:null});
beforeEach(async()=>{const database=await db.dbPromise;await database.clear('entries');await database.clear('foods');});

test('direct calorie-only entries require neither a product nor a guessed weight and retain missing nutrients',async()=>{
  const entry=create({estimated:true});assert.equal(entry.grams,0);assert.equal(entryQuantity(entry),'1 Stück');assert.equal(stats(entry.foodSnapshot,0).kcal,275);assert.equal(entry.foodSnapshot.fiber,null);assert.deepEqual(entry.foodSnapshot.directNutrition.missing,['protein','carbs','sugar','fat','fiber']);assert.equal(validDirectItem(entry),true);
  const saved=await saveEntryWithUndo(entry);assert.equal((await db.listFoods()).length,0);assert.deepEqual(await db.listEntries(entry.date),[entry]);await undoEntryAddition(saved.addition);assert.deepEqual(await db.listEntries(entry.date),[]);
});

test('whole-quantity values are not divided by 100 or multiplied by count; optional weight and known zero survive editing',()=>{
  const entry=create({amount:'2',weight:'180',kcal:'550',protein:'16,2',carbs:'100',sugar:'0',fat:'5',fiber:'3'});
  assert.equal(entry.grams,180);assert.equal(entry.foodSnapshot.portionGrams,90);assert.deepEqual(stats(entry.foodSnapshot,180),{kcal:550,protein:16.2,carbs:100,fat:5,fiber:3});assert.equal(nutrientAmount(entry.foodSnapshot,180,'sugar'),0);assert.equal(entryQuantity(entry),'2 Stück · 180 g');assert.deepEqual(entry.foodSnapshot.directNutrition.missing,[]);assert.equal(initialDirectDraft(entry).sugar,'0');assert.equal(initialDirectDraft(entry).weight,'180');assert.equal(validFood(entry.foodSnapshot),true);
});

test('quantity corrections scale all totals and known weights; copying and undo preserve original snapshots',async()=>{
  const entry=create({weight:'90',protein:'8',carbs:'50',sugar:'2',fat:'2,5',fiber:'1,5',estimated:true});const before=structuredClone(entry);
  const half=withEntryAmount(entry,0.5);assert.equal(half.foodSnapshot.kcal,137.5);assert.equal(half.foodSnapshot.sugar,1);assert.equal(half.grams,45);assert.equal(entryQuantity(half),'0,5 Stück · 45 g');assert.deepEqual(entry,before);
  await db.saveEntry(entry);const result=await saveEntryWithUndo(half);await undoEntryEdit(result.change);assert.deepEqual(await db.listEntries(entry.date),[entry]);
  const scaled=scaleItems(itemsFromEntries([create()]),3);assert.equal(scaled[0].grams,0);assert.equal(mealTotals(scaled).kcal,825);const copy=itemsToEntries(scaled,'2026-11-20','Abendessen')[0];assert.equal(entryQuantity(copy),'3 Stück');assert.equal(copy.foodSnapshot.kcal,825);assert.equal(copy.note,'Vom Bäcker');
});

test('daily and weekly summaries include calories while unknown nutrients remain incomplete and CSV cells stay empty',()=>{
  const entry=create({protein:'8',sugar:'0'}),week=summarizeWeek([entry],[],entry.date);assert.equal(week.totals.kcal,275);assert.equal(week.averages.protein,8);assert.equal(week.missing.includes('protein'),false);assert.equal(week.missing.includes('carbs'),true);
  const columns=dailyCsv([entry],[]).csv.split('\r\n')[1].split(';');assert.equal(columns[2],'275');assert.equal(columns[3],'8');assert.equal(columns[4],'');assert.equal(columns[7],'0');const weekly=weeklyCsv([entry],[]).csv.split('\r\n')[1].split(';');assert.equal(weekly[5],'275');assert.equal(weekly[7],'');
});

test('backups roundtrip direct snapshots without introducing products; malformed direct quantities are rejected atomically',async()=>{
  const entry=create({estimated:true});await db.saveEntry(entry);const backup=await db.getBackup();await db.restoreBackup(backup);assert.deepEqual(await db.listEntries(entry.date),[entry]);assert.deepEqual(await db.listFoods(),[]);await assert.rejects(db.saveFood(entry.foodSnapshot),/Produktdaten/);
  const invalid=structuredClone(backup);invalid.entries[0].amount=2;await assert.rejects(db.restoreBackup(invalid),/Mengenangabe/);assert.deepEqual(await db.listEntries(entry.date),[entry]);
  const translated=create({unitLabel:'1 komad'});await db.saveEntry(translated);await db.restoreBackup(await db.getBackup());assert.equal(validDirectItem((await db.listEntries(entry.date))[0]),true);
});

test('templates and shopping lists retain real counts and optional physical weights instead of inventing grams',()=>{
  const entry=create(),items=itemsFromEntries([entry]),shopping=shoppingFromMeals(scaleItems(items,2));assert.equal(shopping[0].grams,0);assert.equal(shopping[0].quantity.amount,2);assert.equal(validShopping({items:shopping,updatedAt:null}),true);assert.ok(shoppingListText(shopping).includes('2 Stück'));assert.ok(!shoppingListText(shopping).includes('0 g'));
  const merged=mergeShopping(shopping,shopping);assert.equal(merged[0].quantity.amount,4);const weighed=shoppingFromMeals(itemsFromEntries([create({weight:'90'})]));assert.ok(shoppingListText(weighed).includes('1 Stück · 90 g'));
  const mixed=mergeShopping(weighed,shopping);assert.equal(mixed[0].grams,0);assert.ok(!shoppingListText(mixed).includes('90 g'));
});

test('required fields, German decimals and optional blanks are validated; zero kcal is a valid known value',()=>{
  assert.equal(Object.keys(directDraftErrors(draft({kcal:'0',protein:'0'}))).length,0);
  for(const changes of [{name:''},{kcal:''},{kcal:'-1'},{kcal:'NaN'},{amount:'0'},{unitLabel:''},{protein:'-1'},{weight:'0'},{weight:'abc'}])assert.ok(Object.keys(directDraftErrors(draft(changes))).length>0);
  assert.equal(initialDirectDraft(create()).protein,'');assert.equal(initialDirectDraft(create()).kcal,'275');
});
