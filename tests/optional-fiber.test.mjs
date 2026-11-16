import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './helpers/typescript.mjs';
const nutrition=await loadTypeScript(new URL('../src/nutrition.ts',import.meta.url));
const values=await loadTypeScript(new URL('../src/foodValues.ts',import.meta.url));
const {foodEditorErrors}=await loadTypeScript(new URL('../src/foodEditorValidation.ts',import.meta.url));
const {summarizeWeek}=await loadTypeScript(new URL('../src/week.ts',import.meta.url));
const {dailyCsv,weeklyCsv}=await loadTypeScript(new URL('../src/csv.ts',import.meta.url));
const recipes=await loadTypeScript(new URL('../src/recipes.ts',import.meta.url));
const planning=await loadTypeScript(new URL('../src/planning.ts',import.meta.url));
const db=await loadTypeScript(new URL('../src/db.ts',import.meta.url));
const {default:WeeklyDayCard}=await loadTypeScript(new URL('../src/components/WeeklyDayCard.tsx',import.meta.url));
const food={id:'unknown',name:'Ohne Ballaststoffangabe',brand:'',kcal:200,protein:20,carbs:10,sugar:2,fat:4,fiber:null,portionName:'1 Portion',portionGrams:100,createdAt:'2026-11-16T00:00:00Z'};
const known={...food,id:'known',name:'Mit Angabe',fiber:4};
const entry=(snapshot,date='2026-11-16')=>({id:snapshot.id,foodId:snapshot.id,foodSnapshot:{...snapshot},date,meal:'Frühstück',grams:100,amount:100,unit:'g',createdAt:food.createdAt});

test('missing fibre is optional while negative, infinite and malformed values still fail validation',()=>{
  assert.equal(nutrition.validFood(food),true);assert.equal(nutrition.validFood({...food,fiber:0}),true);
  assert.deepEqual(foodEditorErrors({...food,fiber:NaN},{unit:'g',amount:100}),{});
  for(const fiber of [-1,Infinity,'',undefined,NaN])assert.equal(nutrition.validFood({...food,fiber}),false);
  for(const fiber of [-1,Infinity])assert.ok(foodEditorErrors({...food,fiber},{unit:'g',amount:100}).fiber);
  assert.equal(values.scaleNutrients(food,1.5).fiber,null);assert.equal(values.initialFoodEditorDraft(food,true).fiber,null);
  assert.equal(nutrition.stats(food,150).kcal,300);
});

test('mixed weekly totals mark only fibre incomplete and preserve genuine zeroes',()=>{
  const week=summarizeWeek([entry(food),entry(known),entry({...known,id:'zero',fiber:0},'2026-11-17')],[],'2026-11-16');
  assert.equal(week.fiberIncomplete,true);assert.equal(week.days[0].fiberIncomplete,true);assert.equal(week.days[1].fiberIncomplete,false);
  assert.equal(week.days[0].totals.kcal,400);assert.equal(week.days[1].totals.fiber,0);
  const html=renderToStaticMarkup(createElement(WeeklyDayCard,{day:week.days[0],onOpenDay:()=>{}}));assert.match(html,/Unvollständig/);
  const zero=renderToStaticMarkup(createElement(WeeklyDayCard,{day:week.days[1],onOpenDay:()=>{}}));assert.doesNotMatch(zero,/Unvollständig/);
});

test('daily and weekly CSV leave incomplete fibre blank without dropping other nutrients or real zeroes',()=>{
  const entries=[entry(food),entry(known),entry({...known,id:'zero',fiber:0},'2026-11-17')];
  const daily=dailyCsv(entries,[]).csv.trimEnd().split('\r\n').map(row=>row.split(';'));
  assert.equal(daily[1][2],'400');assert.equal(daily[1][6],'');assert.equal(daily[2][6],'0');
  const weekly=weeklyCsv(entries,[]).csv.trimEnd().split('\r\n')[1].split(';');assert.equal(weekly[5],'300');assert.equal(weekly[9],'');
});

test('unknown fibre propagates through nested recipes, selected portions, templates and plans',()=>{
  const ingredients=[recipes.makeIngredient(food,100,'g'),recipes.makeIngredient(known,100,'g')];
  const recipe={servings:2,yieldGrams:200,autoWeight:true,ingredients,instructions:''};
  const built=recipes.buildRecipeFood({...known,id:'recipe'},recipe);assert.equal(built.fiber,null);assert.equal(built.kcal,200);assert.equal(recipes.validRecipeFood(built),true);
  assert.equal(recipes.validRecipeFood({...built,fiber:0}),false);
  const nested=recipes.buildRecipeFood({...known,id:'nested'},{...recipe,ingredients:[recipes.makeIngredient(built,200,'g')]});assert.equal(nested.fiber,null);
  const item=planning.itemFromFood(values.selectPortion(built,built.portionName),1,'portion');assert.equal(planning.validMealItem(item),true);assert.equal(planning.itemsToEntries([item],'2026-11-17','Mittagessen')[0].foodSnapshot.fiber,null);
});

test('null and explicit zero survive food/diary/recipe backups, undo and edits without changing historical snapshots',async()=>{
  await db.saveFood(food);await db.saveFood({...known,fiber:0});await db.saveEntry(entry(food));await db.saveEntry(entry({...known,fiber:0}));
  const backup=JSON.parse(JSON.stringify(await db.getBackup()));await db.restoreBackup(backup);
  assert.equal((await db.listFoods()).find(item=>item.id===food.id).fiber,null);assert.equal((await db.listFoods()).find(item=>item.id===known.id).fiber,0);
  await db.saveFood({...food,fiber:3});assert.equal((await db.listEntries('2026-11-16')).find(item=>item.foodId===food.id).foodSnapshot.fiber,null);
  const revision=db.getDataRevision();const deleted=await db.removeFood(known.id);await db.restoreDeletedFood(deleted,revision);assert.equal((await db.listFoods()).find(item=>item.id===known.id).fiber,0);
});
