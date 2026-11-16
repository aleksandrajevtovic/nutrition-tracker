import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {foodEditorErrors} = await loadTypeScript(new URL('../src/foodEditorValidation.ts',import.meta.url));
const {initialFoodEditorDraft,nutrientKeys} = await loadTypeScript(new URL('../src/foodValues.ts',import.meta.url));
const food = {id:'food',name:'Kartoffel',brand:'',portionName:'Mittel',portionGrams:150,kcal:77,protein:2,carbs:17,sugar:1,fat:0.1,fiber:2,createdAt:'2026-11-16T00:00:00Z'};

test('new manual food drafts start blank without changing shared defaults or treating blanks as zero', () => {
  const original=structuredClone(food);
  const draft=initialFoodEditorDraft(food,false);
  for(const key of nutrientKeys) assert.ok(Number.isNaN(draft[key]),key);
  assert.deepEqual(Object.keys(foodEditorErrors(draft,{unit:'g',amount:100})),nutrientKeys.filter(key=>key!=='fiber'));
  assert.deepEqual(food,original);assert.equal(draft.portionGrams,150);
});

test('existing foods retain explicit zeroes and their original nutrition reference', () => {
  const stored={...food,fat:0,sugar:0,nutritionReference:{unit:'portion',amount:1}};
  const original=structuredClone(stored);const draft=initialFoodEditorDraft(stored,true);
  assert.equal(draft.kcal,115.5);assert.equal(draft.fat,0);assert.equal(draft.sugar,0);
  assert.deepEqual(foodEditorErrors(draft,stored.nutritionReference),{});assert.deepEqual(stored,original);
});

test('imported zeroes and missing values are preserved in their source reference without scaling twice', () => {
  const imported={...food,kcal:45,fat:0,fiber:NaN,nutritionReference:{unit:'ml',amount:100}};
  const draft=initialFoodEditorDraft(imported,false,true);
  assert.equal(draft.kcal,45);assert.equal(draft.fat,0);assert.ok(Number.isNaN(draft.fiber));
  assert.equal(draft.gramsPerMl,undefined);assert.notEqual(draft,imported);
});

test('editor errors identify hidden portion and conversion fields without rejecting valid zero nutrients', () => {
  assert.deepEqual(foodEditorErrors({...food,kcal:0},{unit:'g',amount:100}),{});
  const errors=foodEditorErrors({...food,portionName:' ',portionGrams:0,pieceGrams:-1,carbs:NaN},{unit:'g',amount:0});
  assert.deepEqual(Object.keys(errors).sort(),['carbs','pieceGrams','portionGrams','portionName','referenceAmount'].sort());
  assert.ok(foodEditorErrors(food,{unit:'ml',amount:100}).gramsPerMl);
  assert.deepEqual(foodEditorErrors({...food,gramsPerMl:1.1},{unit:'ml',amount:100}),{});
});

test('editor errors pinpoint duplicate names and missing weights after adding or removing portion cards', () => {
  const portions=[{name:'Klein',grams:80},{name:' Klein ',grams:90},{name:'Mittel',grams:100},{name:'',grams:NaN}];
  const errors=foodEditorErrors({...food,portions},{unit:'g',amount:100});
  assert.deepEqual(Object.keys(errors).sort(),['portions.1.name','portions.2.name','portions.3.name','portions.3.grams'].sort());
  assert.deepEqual(foodEditorErrors({...food,portions:[portions[0],{name:'Groß',grams:250}]},{unit:'g',amount:100}),{});
});

test('barcode validation accepts formatting; imported values still require explicit review', () => {
  assert.deepEqual(foodEditorErrors({...food,barcode:'4006 3813-33931'},{unit:'g',amount:100}),{});
  const errors=foodEditorErrors({...food,barcode:'invalid',name:' '},{unit:'g',amount:100},true,false);
  assert.deepEqual(Object.keys(errors).sort(),['barcode','name','reviewed']);
  assert.deepEqual(foodEditorErrors(food,{unit:'g',amount:100},true,true),{});
});
