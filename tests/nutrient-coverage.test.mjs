import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {nutrientCoverage} = await loadTypeScript(new URL('../src/nutrientCoverage.ts', import.meta.url));
const known = {foodSnapshot:{name:'Banane',protein:1.1,fiber:2}};
const missing = {foodSnapshot:{name:'Brezel',protein:0,fiber:null,directNutrition:{missing:['protein','carbs','fat','fiber']}}};

test('coverage distinguishes partial known values from all missing, including legacy fibre',()=>{
  assert.deepEqual(nutrientCoverage([known,missing],'protein'),{missing:true,hasKnown:true});
  assert.deepEqual(nutrientCoverage([missing],'protein'),{missing:true,hasKnown:false});
  assert.deepEqual(nutrientCoverage([{foodSnapshot:{fiber:null}}],'fiber'),{missing:true,hasKnown:false});
  assert.deepEqual(nutrientCoverage([known],'protein'),{missing:false,hasKnown:true});
});
test('known zero stays known; missing values cannot change an empty day into an unknown one',()=>{
  assert.deepEqual(nutrientCoverage([{foodSnapshot:{protein:0}},missing],'protein'),{missing:true,hasKnown:true});
  assert.deepEqual(nutrientCoverage([],'protein'),{missing:false,hasKnown:false});
  assert.deepEqual(nutrientCoverage([missing],'kcal'),{missing:false,hasKnown:true});
});
