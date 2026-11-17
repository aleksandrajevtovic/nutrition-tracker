import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {scaleRecentAmount}=await loadTypeScript(new URL('../src/diaryHistory.ts',import.meta.url));
const {toGrams}=await loadTypeScript(new URL('../src/nutrition.ts',import.meta.url));
const food={id:'food',name:'Joghurt',brand:'',kcal:100,protein:10,carbs:10,sugar:1,fat:1,fiber:null,portionName:'1 Becher',portionGrams:150,pieceGrams:80,sliceGrams:30,gramsPerMl:0.92,createdAt:'2026-11-17T00:00:00Z'};

test('half, single and double preserve each unit, current snapshot and fractional portion size without mutating the original',()=>{
  for(const unit of ['g','mg','kg','ml','l','portion','piece','slice']){
    const amount=unit==='kg'||unit==='l'?0.125:1.25,item={food,amount,unit,grams:toGrams(food,amount,unit)},before=structuredClone(item);
    for(const factor of [0.5,1,2]){const scaled=scaleRecentAmount(item,factor);assert.equal(scaled.amount,amount*factor);assert.equal(scaled.unit,unit);assert.equal(scaled.food,food);assert.equal(scaled.grams,toGrams(food,amount*factor,unit));assert.deepEqual(item,before);}
  }
});

test('invalid factors, missing conversions and overflowing amounts never create invalid diary quantities',()=>{
  const item={food,amount:2,unit:'portion',grams:300};for(const factor of [0,-1,NaN,Infinity])assert.equal(scaleRecentAmount(item,factor),undefined);
  assert.equal(scaleRecentAmount({...item,amount:Number.MAX_VALUE,unit:'g'},2),undefined);
  assert.equal(scaleRecentAmount({...item,unit:'ml',food:{...food,gramsPerMl:undefined}},2),undefined);
  const precise={...item,amount:1.23456789012345,unit:'g'};assert.equal(scaleRecentAmount(precise,1).amount,precise.amount);
});
