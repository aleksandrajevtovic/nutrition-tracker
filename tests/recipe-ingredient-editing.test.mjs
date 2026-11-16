import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {changeIngredientUnit}=await loadTypeScript(new URL('../src/recipeIngredients.ts',import.meta.url));
const {makeIngredient,recipeTotals,validIngredient,buildRecipeFood}=await loadTypeScript(new URL('../src/recipes.ts',import.meta.url));
const food={id:'food',name:'Joghurt',brand:'',portionName:'1 Becher',portionGrams:150,pieceGrams:75,gramsPerMl:0.92,kcal:100,protein:10,carbs:5,sugar:2,fat:3,fiber:null,createdAt:'2026-11-16T00:00:00Z'};

test('changing ingredient units keeps the physical amount and all recipe nutrients',()=>{
  const original=makeIngredient(food,150,'g'),before=structuredClone(original);
  for(const [unit,amount]of [['kg',0.15],['mg',150000],['portion',1],['piece',2],['ml',150/0.92],['l',150/920]]){
    const next=changeIngredientUnit(original,unit);assert.ok(Math.abs(next.amount-amount)<Math.max(1e-9,amount*1e-10));assert.ok(Math.abs(next.grams-150)<1e-8);assert.equal(next.id,original.id);assert.equal(next.foodSnapshot,original.foodSnapshot);assert.equal(validIngredient(next),true);assert.ok(Math.abs(recipeTotals([next]).kcal-150)<1e-8);
  }
  assert.deepEqual(original,before);
});

test('unsupported conversions and invalid pending amounts never become invented valid quantities',()=>{
  const original=makeIngredient({...food,gramsPerMl:undefined},100,'g');assert.equal(changeIngredientUnit(original,'ml'),original);
  const invalid={...original,amount:NaN,grams:NaN};const changed=changeIngredientUnit(invalid,'kg');assert.ok(Number.isNaN(changed.amount));assert.equal(validIngredient(changed),false);
});

test('repeated unit changes preserve custom yield, fractional servings and missing fibre semantics',()=>{
  let ingredient=makeIngredient(food,0.5,'portion');for(const unit of ['mg','kg','ml','l','g','portion'])ingredient=changeIngredientUnit(ingredient,unit);
  assert.equal(ingredient.amount,0.5);assert.equal(ingredient.grams,75);const recipe=buildRecipeFood({...food,id:'recipe'},{ingredients:[ingredient],servings:1.5,yieldGrams:60,autoWeight:false,instructions:'Zubereitung'});
  assert.equal(recipe.kcal,125);assert.equal(recipe.portionGrams,40);assert.equal(recipe.fiber,null);assert.deepEqual(recipe.recipe.ingredients[0].foodSnapshot,food);
});
