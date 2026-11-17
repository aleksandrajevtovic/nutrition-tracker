import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {duplicateRecipeFood,buildRecipeFood,makeIngredient,validRecipeFood}=await loadTypeScript(new URL('../src/recipes.ts',import.meta.url));
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const food={id:'oats',name:'Haferflocken',brand:'',kcal:400,protein:10,carbs:60,sugar:1,fat:10,fiber:null,portionName:'1 Becher',portionGrams:150,portions:[{name:'Klein',grams:75}],createdAt:'2026-11-15T00:00:00Z'};
const recipe=autoWeight=>buildRecipeFood({...food,id:'recipe',name:'Porridge',brand:'Eigenes Rezept',favorite:true,barcode:'4006381333931',source:{type:'openfoodfacts',importedAt:food.createdAt}},
  {servings:2.5,yieldGrams:autoWeight?150:125,autoWeight,ingredients:[makeIngredient(food,1,'portion')],instructions:'Mit Wasser\nkurz aufkochen.'});

test('recipe copies preserve portions, raw snapshots, missing fibre, notes and manual/automatic yield with independent identities',()=>{
  for(const autoWeight of [true,false]){
    const original=recipe(autoWeight),before=structuredClone(original),copy=duplicateRecipeFood(original);
    assert.notEqual(copy.id,original.id);assert.equal(copy.name,'Porridge (Kopie)');assert.equal(copy.favorite,false);
    assert.equal(copy.barcode,undefined);assert.equal(copy.source,undefined);assert.ok(Date.parse(copy.createdAt)>=Date.parse(original.createdAt));
    assert.equal(validRecipeFood(copy),true);assert.equal(copy.fiber,null);assert.equal(copy.portionGrams,original.portionGrams);
    assert.equal(copy.recipe.autoWeight,autoWeight);assert.equal(copy.recipe.yieldGrams,original.recipe.yieldGrams);assert.equal(copy.recipe.servings,2.5);assert.equal(copy.recipe.instructions,original.recipe.instructions);
    assert.notEqual(copy.recipe.ingredients[0].id,original.recipe.ingredients[0].id);
    assert.deepEqual(copy.recipe.ingredients[0].foodSnapshot,original.recipe.ingredients[0].foodSnapshot);
    copy.recipe.instructions='Neue Variante';copy.recipe.ingredients[0].foodSnapshot.portions[0].grams=80;copy.portions[0].name='Andere Größe';
    assert.deepEqual(original,before);
    assert.notEqual(duplicateRecipeFood(original).id,duplicateRecipeFood(original).id);
  }
  assert.throws(()=>duplicateRecipeFood(food),/gültiges Rezept/);
});

test('creating a draft writes nothing; saving and editing a copy leaves the original, diary snapshots and backup data intact',async()=>{
  const original=recipe(false);await db.saveFood(food);await db.saveFood(original);
  const entry={id:'history',foodId:original.id,foodSnapshot:structuredClone(original),date:'2026-11-15',meal:'Frühstück',amount:1,unit:'portion',grams:original.portionGrams,createdAt:food.createdAt};
  await db.saveEntry(entry);const before=await db.getBackup();
  const copy=duplicateRecipeFood(original);assert.deepEqual((await db.getBackup()).foods,before.foods);
  const modified=buildRecipeFood({...copy,name:'Porridge mit Banane'},{...copy.recipe,servings:3,instructions:'Andere Zubereitung',ingredients:[makeIngredient(food,2,'portion')]});
  await db.saveFood(modified);const saved=await db.getBackup();assert.equal(saved.foods.length,3);
  assert.deepEqual(saved.foods.find(item=>item.id===original.id),original);assert.deepEqual(saved.entries,[entry]);
  await db.restoreBackup(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual((await db.getBackup()).foods.find(item=>item.id===copy.id),modified);
  await db.saveFood({...modified,name:'Geänderte Kopie'});await db.removeFood(copy.id);
  assert.deepEqual((await db.getBackup()).foods.find(item=>item.id===original.id),original);assert.deepEqual((await db.getBackup()).entries,[entry]);
});
