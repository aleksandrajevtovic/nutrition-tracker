import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test,{beforeEach} from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const {germanError}=await loadTypeScript(new URL('../src/german.ts',import.meta.url));
const food={id:'manual',name:'Mein Joghurt',brand:'Eigene Marke',kcal:220,protein:12,carbs:14,sugar:5,fat:9,fiber:null,portionName:'1 Becher',portionGrams:150,portions:[{name:'Klein',grams:75}],pieceGrams:50,sliceGrams:20,gramsPerMl:1.05,nutritionReference:{unit:'portion',amount:1},favorite:true,createdAt:'2026-11-17T00:00:00Z'};
const entry={id:'history',foodId:food.id,foodSnapshot:structuredClone(food),date:'2026-11-17',meal:'Frühstück',amount:1,unit:'portion',grams:150,note:'Historisch',createdAt:food.createdAt};
beforeEach(async()=>{const database=await db.dbPromise;await database.clear('foods');await database.clear('entries');await db.saveFood(structuredClone(food));await db.saveEntry(structuredClone(entry));});

test('assigning a cleaned barcode changes only that field and preserves corrected nutrients, portions, favourites, identity and diary snapshots',async()=>{
  const linked=await db.assignFoodBarcode(food.id,'4006 3813-33931');assert.deepEqual(linked,{...food,barcode:'4006381333931'});assert.deepEqual(await db.listFoods(),[linked]);assert.deepEqual((await db.getBackup()).entries,[entry]);assert.equal(linked.source,undefined);
  await db.restoreBackup(JSON.parse(JSON.stringify(await db.getBackup())));assert.deepEqual(await db.listFoods(),[linked]);
});

test('assignment reads current product values atomically and concurrent claims cannot create duplicate barcodes',async()=>{
  const current={...food,kcal:333,portionGrams:160,favorite:false};await db.saveFood(current);assert.deepEqual(await db.assignFoodBarcode(food.id,'036000291452'),{...current,barcode:'036000291452'});
  await db.saveFood({...food,id:'second'});await db.saveFood({...food,id:'third'});const results=await Promise.allSettled([db.assignFoodBarcode('second','4006381333931'),db.assignFoodBarcode('third','4006381333931')]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal((await db.listFoods()).filter(value=>value.barcode==='4006381333931').length,1);
});

test('equivalent UPC/EAN identities and a different existing barcode are protected from reassignment',async()=>{
  await db.assignFoodBarcode(food.id,'036000291452');await db.saveFood({...food,id:'second'});const before=await db.listFoods();await assert.rejects(db.assignFoodBarcode('second','0036000291452'),/bereits zu einem gespeicherten/);await assert.rejects(db.assignFoodBarcode(food.id,'4006381333931'),error=>{assert.match(error.message,/anderen Barcode/);assert.equal(germanError(error),error.message);return true;});assert.deepEqual(await db.listFoods(),before);
});

test('invalid barcodes and deleted products never create or partially overwrite records',async()=>{
  const before=await db.listFoods();for(const code of ['', '123','4006381333932'])await assert.rejects(db.assignFoodBarcode(food.id,code),/gültigen EAN/);assert.deepEqual(await db.listFoods(),before);await db.removeFood(food.id);await assert.rejects(db.assignFoodBarcode(food.id,'4006381333931'),/nicht mehr vorhanden/);assert.deepEqual(await db.listFoods(),[]);assert.deepEqual((await db.getBackup()).entries,[entry]);
});

test('a data import invalidates a previously opened assignment even if the selected product ID remains unchanged',async()=>{
  const revision=db.getDataRevision();await db.restoreBackup(await db.getBackup());await assert.rejects(db.assignFoodBarcode(food.id,'4006381333931',revision),error=>{assert.match(error.message,/erneut öffnen/);assert.equal(germanError(error),error.message);return true;});assert.deepEqual(await db.listFoods(),[food]);
});

test('failed writes leave custom values untouched and can be retried without producing another product',async()=>{
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='foods')throw new DOMException('Failure','QuotaExceededError');return put.apply(this,args);};
  try {await assert.rejects(db.assignFoodBarcode(food.id,'4006381333931'));assert.deepEqual(await db.listFoods(),[food]);}finally{IDBObjectStore.prototype.put=put;}
  await db.assignFoodBarcode(food.id,'4006381333931');assert.equal((await db.listFoods()).length,1);
});
