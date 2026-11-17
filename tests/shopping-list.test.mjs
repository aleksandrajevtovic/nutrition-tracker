import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {groupShoppingItems,shoppingListText,shoppingAmount}=await loadTypeScript(new URL('../src/shoppingList.ts',import.meta.url));
const item=(id,name,grams,checked=false,brand='')=>({id,foodId:id,name,grams,checked,brand});

test('shopping groups retain every item and its order without mutating persisted checks or quantities',()=>{
  const items=[item('a','Apfel',150,true),item('b','Banane',1500),item('c','Kirschtomaten',250),item('d','Salz',2.25,true)];
  const before=structuredClone(items),groups=groupShoppingItems(items);
  assert.deepEqual(groups.open.map(value=>value.id),['b','c']);assert.deepEqual(groups.purchased.map(value=>value.id),['a','d']);
  assert.deepEqual(items,before);assert.deepEqual(groupShoppingItems([]),{open:[],purchased:[]});
});

test('shareable German text includes open and purchased items, brands, amounts and safe single-line names',()=>{
  const items=[item('a','Apfel',150,true),item('b','Banane',1500,false,'Bio'),item('c','Grüne\n Bohnen',250,false,'Marke\t A'),item('d','Salz',2.25,true)];
  const before=structuredClone(items);
  assert.equal(shoppingListText(items),'Einkaufsliste\n\nNoch offen (2)\n[ ] Banane (Bio) · 1,5 kg\n[ ] Grüne Bohnen (Marke A) · 250 g\n\nGekauft (2)\n[x] Apfel · 150 g\n[x] Salz · 2,25 g');
  assert.deepEqual(items,before);assert.equal(shoppingAmount(1000),'1 kg');assert.equal(shoppingAmount(0.125),'0,125 g');
});

test('empty and purchased-only lists do not invent open items and text always reflects changed checks',()=>{
  assert.equal(shoppingListText([]),'Einkaufsliste\n\nDie Liste ist leer.');
  const purchased=item('a','Öl',25,true);
  assert.equal(shoppingListText([purchased]),'Einkaufsliste\n\nGekauft (1)\n[x] Öl · 25 g');
  assert.equal(shoppingListText([{...purchased,checked:false}]),'Einkaufsliste\n\nNoch offen (1)\n[ ] Öl · 25 g');
});
