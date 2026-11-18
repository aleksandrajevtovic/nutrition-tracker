import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {DraftRecovery,readRecovery,draftRecoveryKey}=await loadTypeScript(new URL('../src/draftRecovery.ts',import.meta.url));
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
const guard=(scope,dirty=true)=>({scope,label:scope,baseline:'"original"',dirty});

test('clean UI never creates recovery; dirty drafts include original baselines, fields and route',()=>{
  const store=storage(),model=new DraftRecovery(store,'tab');
  model.setValue('App:date','2026-11-18');model.setValue('EntryEditor:note','Nicht gespeichert');model.setGuard('entry',guard('entry-editor',false));model.flush();assert.equal(readRecovery(store),undefined);
  model.setGuard('entry',guard('entry-editor'));model.flush();const snapshot=readRecovery(store);
  assert.equal(snapshot.values['App:date'].value,'2026-11-18');assert.equal(snapshot.values['EntryEditor:note'].value,'Nicht gespeichert');assert.equal(snapshot.guards['entry-editor'].baseline,'"original"');
});

test('reload restores incomplete values and undefined selections without changing the original baseline',()=>{
  const store=storage(),model=new DraftRecovery(store,'first');
  for(const [key,value]of [['amount',''],['selected',undefined],['portion',{name:'Klein',grams:80}],['ingredients',[{grams:15}]]])model.setValue(key,value);
  model.setGuard('entry',guard('entry-editor'));model.flush();const snapshot=readRecovery(store),restored=new DraftRecovery(store,'second');restored.resume(snapshot);
  assert.equal(restored.initial('amount',()=>99),'');assert.equal(restored.initial('selected',()=>99),undefined);assert.deepEqual(restored.initial('portion',()=>null),{name:'Klein',grams:80});assert.deepEqual(restored.initial('ingredients',()=>[]),[{grams:15}]);assert.equal(restored.baseline('entry-editor','new'),'"original"');
  restored.setValue('amount','');restored.setGuard('entry',guard('entry-editor'));restored.flush();assert.equal(readRecovery(store).owner,'second');assert.deepEqual(readRecovery(store).values.ingredients.value,[{grams:15}]);
});

test('saving or deliberately unmounting clears only finished drafts; a later form starts fresh',()=>{
  const store=storage(),model=new DraftRecovery(store,'owner');model.setValue('entry','original');model.setGuard('entry',guard('entry'));model.setGuard('recipe',guard('recipe'));model.flush();
  model.setGuard('entry',guard('entry',false));model.flush();assert.deepEqual(Object.keys(readRecovery(store).guards),['recipe']);model.guards.delete('recipe');model.flush();assert.equal(readRecovery(store),undefined);
  assert.equal(model.initial('entry',()=> 'fresh'),'fresh');
});

test('discard and data import clear recovery; new edits after import can be protected again',()=>{
  const store=storage(),model=new DraftRecovery(store,'owner');model.setGuard('entry',guard('entry'));model.flush();model.invalidate();assert.equal(readRecovery(store),undefined);model.flush();assert.equal(readRecovery(store),undefined);
  model.setGuard('note',guard('note'));model.flush();assert.deepEqual(Object.keys(readRecovery(store).guards),['note']);model.discard();model.flush();assert.equal(readRecovery(store),undefined);
});

test('corrupt, incompatible or oversized records are ignored without crashing',()=>{
  const store=storage();for(const value of ['{','null','{}',JSON.stringify({version:2}),JSON.stringify({version:1,owner:'x',savedAt:'invalid',values:{},guards:{}}),' '.repeat(2_000_001)]){store.setItem(draftRecoveryKey,value);assert.equal(readRecovery(store),undefined);}
  assert.equal(readRecovery({getItem(){throw Error('Disabled');}}),undefined);
});

test('storage errors never escape and a clean second tab cannot delete the first tab draft',()=>{
  const store=storage(),first=new DraftRecovery(store,'first'),second=new DraftRecovery(store,'second');first.setGuard('entry',guard('entry'));first.flush();second.flush();assert.equal(readRecovery(store).owner,'first');
  let errors=0;const failed=new DraftRecovery({getItem(){throw Error('Disabled');},setItem(){throw Error('Quota');},removeItem(){throw Error('Disabled');}},'owner',()=>errors++);failed.setGuard('entry',guard('entry'));assert.doesNotThrow(()=>failed.flush());assert.equal(errors,1);
});
