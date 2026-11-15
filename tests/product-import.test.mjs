import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {validBarcode,cleanBarcode,barcodeKey} = await loadTypeScript(new URL('../src/barcode.ts', import.meta.url));
const {mapOpenFoodFacts,lookupProduct} = await loadTypeScript(new URL('../src/productImport.ts', import.meta.url));
const {parseLabelNutrition} = await loadTypeScript(new URL('../src/labelNutrition.ts', import.meta.url));
const {validFood,stats,toGrams} = await loadTypeScript(new URL('../src/nutrition.ts', import.meta.url));
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const code = '4006381333931';
const nutrients = {'energy-kcal_100g':200,proteins_100g:12,carbohydrates_100g:20,sugars_100g:3,fat_100g:8,fiber_100g:0};
const response = product => ({status:1,product:{product_name:'Produkt',nutriments:nutrients,...product}});

test('GTIN check digits, leading zeroes and formatting are handled without losing identity', () => {
  for(const value of ['96385074','036000291452',code,'0036000291452','00036000291452']) assert.equal(validBarcode(value),true,value);
  for(const value of ['4006381333932','123','code',12345678,'4006381333931x']) assert.equal(validBarcode(value),false,String(value));
  assert.equal(cleanBarcode('4006 3813-33931'),code);
  assert.equal(barcodeKey('036000291452'),barcodeKey('0036000291452'));
});

test('product mapping prefers German names, standard per-100 values and serving weights', () => {
  const {food,missing} = mapOpenFoodFacts(response({product_name_de:'Haferflocken',brands:'Marke',serving_size:'1 Schale (40 g)',quantity:'500 g'}),code);
  assert.equal(food.name,'Haferflocken');assert.equal(food.portionGrams,40);assert.equal(food.kcal,200);assert.equal(food.fiber,0);
  assert.equal(stats(food,40).kcal,80);assert.deepEqual(missing,[]);assert.equal(validFood(food),true);
  assert.equal(food.source.type,'openfoodfacts');assert.equal(food.barcode,code);
});

test('missing data stays missing; kJ fallback converts once and never uses prepared or raw serving values', () => {
  const mapped = mapOpenFoodFacts(response({nutriments:{'energy-kj_100g':418.4,proteins_100g:'2,5',fat_100g:-3,carbohydrates_serving:12,fiber_prepared_100g:4}}),code);
  assert.ok(Math.abs(mapped.food.kcal-100)<1e-9);assert.equal(mapped.food.protein,2.5);
  for(const key of ['fat','carbs','fiber','sugar']) assert.ok(Number.isNaN(mapped.food[key]));
  assert.deepEqual(mapped.missing,['carbs','sugar','fat','fiber']);assert.equal(validFood(mapped.food),false);
  assert.equal(mapOpenFoodFacts({status:0},code),null);assert.equal(mapOpenFoodFacts(null,code),null);
  assert.ok(Number.isNaN(mapOpenFoodFacts(response({nutriments:{fiber_100g:'   '}}),code).food.fiber));
});

test('liquid imports preserve per-100ml values and require an explicit density', () => {
  const {food} = mapOpenFoodFacts(response({product_quantity_unit:'ml',serving_size:'250 ml'}),code);
  assert.deepEqual(food.nutritionReference,{unit:'ml',amount:100});assert.equal(food.gramsPerMl,undefined);
  assert.ok(Number.isNaN(toGrams(food,250,'ml')));assert.equal(validFood(food),false);
  const normalized={...food,gramsPerMl:1.1,...Object.fromEntries(['kcal','protein','carbs','sugar','fat','fiber'].map(key=>[key,food[key]/1.1]))};
  assert.equal(validFood(normalized),true);assert.ok(Math.abs(stats(normalized,toGrams(normalized,250,'ml')).kcal-500)<1e-9);
});

test('photo parser selects one column, preserves decimal commas and converts mg', () => {
  const text='Nährwerte pro 100 g pro Portion\nEnergie 840 kJ / 200 kcal 420 kJ / 100 kcal\nFett 8,5 g 4,25 g\ndavon gesättigte Fettsäuren 2 g 1 g\nKohlenhydrate 20 g 10 g\ndavon Zucker 3,2 g 1,6 g\nBallaststoffe 500 mg 250 mg\nEiweiß 12 g 6 g';
  const first = parseLabelNutrition(text);assert.deepEqual(first.reference,{unit:'g',amount:100});
  assert.deepEqual(first.values,{kcal:200,fat:8.5,carbs:20,sugar:3.2,fiber:0.5,protein:12});
  const second=parseLabelNutrition(text,1);assert.equal(second.reference,undefined);assert.equal(second.values.kcal,100);assert.equal(second.values.fiber,0.25);
});

test('photo parser does not invent zeroes, exact values for bounds or a reference from nutrient rows', () => {
  const parsed=parseLabelNutrition('Fett 8 g\nZucker < 0,5 g\nEiweiß 0 g');
  assert.deepEqual(parsed.values,{fat:8,protein:0});assert.equal(parsed.reference,undefined);
  assert.ok(parsed.warnings.some(value=>value.includes('kleiner als')));
  assert.deepEqual(parseLabelNutrition('pro 250 ml\nEnergie 418,4 kJ\nProtein 2 g').reference,{unit:'ml',amount:250});
  assert.ok(Math.abs(parseLabelNutrition('Energy 418.4 kJ').values.kcal-100)<1e-9);
  assert.equal(parseLabelNutrition('Total Fat 8 g\nSaturated Fat 2 g\nTrans Fat 0 g').values.fat,8);
});

test('product lookup handles not found, failures, limits and cancellation without writing data', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async url=>{assert.ok(String(url).includes(code));assert.ok(String(url).includes('fields='));return new Response(JSON.stringify(response({})),{status:200});};
    assert.equal((await lookupProduct(code)).food.kcal,200);
    globalThis.fetch=async()=>new Response('',{status:404});assert.equal(await lookupProduct(code),null);
    globalThis.fetch=async()=>new Response('',{status:429});await assert.rejects(lookupProduct(code),/Zu viele/);
    globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};await assert.rejects(lookupProduct(code),/Internetverbindung/);
    globalThis.fetch=async(_url,{signal})=>{signal.throwIfAborted();};
    const controller=new AbortController();controller.abort();await assert.rejects(lookupProduct(code,controller.signal),{name:'AbortError'});
    await assert.rejects(lookupProduct('invalid'),/gültigen/);assert.deepEqual(await db.listFoods(),[]);
  } finally {globalThis.fetch=original;}
});

test('barcode corrections persist, duplicate identities cannot overwrite them, and backups keep provenance', async () => {
  const {food}=mapOpenFoodFacts(response({}), '036000291452');
  await db.saveFood({...food,kcal:220});
  await assert.rejects(db.saveFood({...food,id:'duplicate',barcode:'0036000291452'}),/bereits/);
  assert.equal((await db.listFoods()).length,1);assert.equal((await db.listFoods())[0].kcal,220);
  const backup=JSON.parse(JSON.stringify(await db.getBackup()));await db.restoreBackup(backup);
  const restored=(await db.listFoods())[0];assert.equal(restored.barcode,food.barcode);assert.deepEqual(restored.source,food.source);assert.equal(restored.kcal,220);
  await assert.rejects(db.saveFood({...food,barcode:'4006381333932'}),/Produktdaten/);
  await assert.rejects(db.restoreBackup({...backup,foods:[{...food,source:{type:'other'}}]}),/Produktdaten/);
  assert.equal((await db.listFoods())[0].kcal,220);
  await assert.rejects(db.restoreBackup({...backup,foods:[food,{...food,id:'duplicate',barcode:'0036000291452'}]}),/bereits/);
  const revision=db.getDataRevision();const removed=await db.removeFood(food.id);
  await db.saveFood({...food,id:'replacement'});
  await assert.rejects(db.restoreDeletedFood(removed,revision),/bereits/);
  assert.equal((await db.listFoods()).length,1);
});
