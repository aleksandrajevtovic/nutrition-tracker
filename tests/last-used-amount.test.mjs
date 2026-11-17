import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {lastUsedAmount}=await loadTypeScript(new URL('../src/diaryHistory.ts',import.meta.url));
const {toGrams}=await loadTypeScript(new URL('../src/nutrition.ts',import.meta.url));
const food={id:'food',name:'Kartoffel',brand:'Bio',kcal:77,protein:2,carbs:17,fat:0.1,fiber:2.2,sugar:0.8,portionName:'Mittel',portionGrams:150,portions:[{name:'Klein',grams:80}],pieceGrams:150,sliceGrams:30,gramsPerMl:0.92,createdAt:'2026-11-15T00:00:00Z'};
const entry={id:'entry',foodId:food.id,foodSnapshot:structuredClone(food),date:'2026-11-15',meal:'Frühstück',amount:1,unit:'portion',grams:150,note:'Historische Notiz',createdAt:'2026-11-15T10:00:00Z'};

test('last quantity finds the selected product beyond the six recent foods and uses latest recording with current nutrients',()=>{
  const others=Array.from({length:8},(_,i)=>({...entry,id:`other-${i}`,foodId:`other-${i}`,createdAt:`2026-11-16T1${i}:00:00Z`}));
  const latest={...entry,id:'latest',date:'2026-11-13',createdAt:'2026-11-15T11:00:00Z',amount:175,unit:'g',grams:175};
  const entries=[entry,latest,...others],before=structuredClone(entries),current={...food,kcal:90};
  const result=lastUsedAmount(entries,current);
  assert.equal(result.amount,175);assert.equal(result.unit,'g');assert.equal(result.grams,175);assert.equal(result.food.kcal,90);assert.equal(result.note,undefined);
  assert.deepEqual(entries,before);assert.equal(lastUsedAmount(entries,{...food,id:'unused'}),undefined);assert.equal(lastUsedAmount([],food),undefined);
});

test('every configured unit and named portion preserves its last quantity without changing foods or snapshots',()=>{
  for(const unit of ['g','mg','kg','ml','l','portion','piece','slice']){
    const amount=unit==='kg'||unit==='l'?0.125:2.5,grams=toGrams(food,amount,unit);
    const record={...entry,amount,grams,unit},before=structuredClone(record),result=lastUsedAmount([record],food);
    assert.equal(result.amount,amount);assert.equal(result.unit,unit);assert.equal(result.grams,grams);assert.deepEqual(record,before);
  }
  const small={...entry,amount:2,grams:160,foodSnapshot:{...food,portionName:'Klein',portionGrams:80}};
  const result=lastUsedAmount([small],food);assert.equal(result.food.portionName,'Klein');assert.equal(result.amount,2);assert.equal(result.grams,160);assert.equal(food.portionName,'Mittel');
  const {amount,unit,...legacy}=entry;assert.deepEqual(lastUsedAmount([legacy],food),{food,amount:150,unit:'g',grams:150});
});

test('changed or missing conversion weights fall back to recorded grams rather than mislabelling a new quantity as last used',()=>{
  const small={...entry,amount:2,grams:160,foodSnapshot:{...food,portionName:'Klein',portionGrams:80}};
  for(const current of [{...food,portions:[]},{...food,portions:[{name:'Klein',grams:90}]}]){
    const result=lastUsedAmount([small],current);assert.equal(result.unit,'g');assert.equal(result.amount,160);assert.equal(result.grams,160);
  }
  for(const [unit,key] of [['portion','portionGrams'],['ml','gramsPerMl'],['piece','pieceGrams'],['slice','sliceGrams']]){
    const grams=toGrams(food,2,unit),record={...entry,amount:2,unit,grams};
    const result=lastUsedAmount([record],{...food,[key]:food[key]*2});assert.equal(result.unit,'g');assert.equal(result.amount,grams);assert.equal(result.grams,grams);
  }
  const volume={...entry,unit:'ml',amount:100,grams:92};assert.equal(lastUsedAmount([volume],{...food,gramsPerMl:undefined}).unit,'g');
  assert.equal(lastUsedAmount([{...entry,grams:0,amount:0}],food),undefined);
});
