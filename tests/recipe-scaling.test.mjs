import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {recipeForServings}=await loadTypeScript(new URL('../src/recipeScaling.ts',import.meta.url));
const {makeIngredient,recipeTotals,validRecipe}=await loadTypeScript(new URL('../src/recipes.ts',import.meta.url));
const food={id:'yogurt',name:'Joghurt',brand:'Bio',kcal:100,protein:10,carbs:10,fat:1,sugar:2,fiber:null,portionName:'1 Becher',portionGrams:150,pieceGrams:80,sliceGrams:30,gramsPerMl:0.92,createdAt:'2026-11-18T00:00:00Z'};
const recipe={servings:2,yieldGrams:500,autoWeight:false,ingredients:[makeIngredient(food,2,'portion'),makeIngredient(food,100,'ml'),makeIngredient({...food,portionName:'Klein',portionGrams:80},2,'portion')],instructions:'Für 2 Portionen.\nKurz aufkochen.'};

test('cooking view scales portions, named sizes, volume and manual yield proportionally while preserving source snapshots and text',()=>{
  const before=structuredClone(recipe),scaled=recipeForServings(recipe,3);
  assert.equal(scaled.servings,3);assert.equal(scaled.yieldGrams,750);assert.equal(scaled.autoWeight,false);
  assert.deepEqual(scaled.ingredients.map(value=>value.amount),[3,150,3]);assert.deepEqual(scaled.ingredients.map(value=>value.grams),[450,138,240]);
  assert.deepEqual(scaled.ingredients.map(value=>value.unit),['portion','ml','portion']);assert.equal(scaled.ingredients[2].foodSnapshot.portionName,'Klein');assert.equal(scaled.instructions,recipe.instructions);assert.equal(scaled.ingredients[0].foodSnapshot.fiber,null);
  assert.deepEqual(recipe,before);assert.equal(validRecipe(scaled),true);
});

test('fractional servings and automatic yield retain nutrition per portion and do not accumulate rounding across repeated views',()=>{
  const automatic={...recipe,autoWeight:true,yieldGrams:recipeTotals(recipe.ingredients).grams},totals=recipeTotals(automatic.ingredients);
  for(const servings of [0.5,1,2.5,3,10,2]){
    const scaled=recipeForServings(automatic,servings),values=recipeTotals(scaled.ingredients);
    assert.equal(validRecipe(scaled),true);assert.ok(Math.abs(values.grams-scaled.yieldGrams)<1e-8);assert.ok(Math.abs(values.kcal/servings-totals.kcal/automatic.servings)<1e-8);assert.equal(scaled.ingredients[0].foodSnapshot.kcal,100);
  }
  assert.deepEqual(recipeForServings(recipe,recipe.servings),recipe);
});

test('invalid, overflowing and underflowing cooking quantities are rejected without changing the saved recipe',()=>{
  const before=structuredClone(recipe);for(const servings of [0,-1,NaN,Infinity,Number.MAX_VALUE,Number.MIN_VALUE])assert.equal(recipeForServings(recipe,servings),undefined);
  assert.equal(recipeForServings({...recipe,servings:0},2),undefined);assert.deepEqual(recipe,before);
});
