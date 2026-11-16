import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTypeScript} from './helpers/typescript.mjs';
const {portionNameLabel,portionUnitLabel,portionQuantity,entryQuantity}=await loadTypeScript(new URL('../src/quantityLabels.ts',import.meta.url));

test('common named portions replace redundant single-unit prefixes and use German plurals',()=>{
  for(const [amount,name,grams,expected]of [[2,'1 Becher',300,'2 Becher · 300 g'],[1,'1 Scheibe',30,'1 Scheibe · 30 g'],[2,'Scheibe',60,'2 Scheiben · 60 g'],[0.5,'1 Portion',75,'0,5 Portion · 75 g'],[1.5,'Portion',225,'1,5 Portionen · 225 g'],[2,'1 Glas',400,'2 Gläser · 400 g'],[2,'1 Ei',120,'2 Eier · 120 g'],[2,'1 Esslöffel',30,'2 Esslöffel · 30 g']])assert.equal(portionQuantity(amount,name,grams),expected);
});

test('custom portion names retain their meaning, counts and arbitrary text safely',()=>{
  assert.equal(portionQuantity(2,'Klein',160),'2 × Klein · 160 g');
  assert.equal(portionQuantity(0.5,'Groß',125),'0,5 × Groß · 125 g');
  assert.equal(portionQuantity(1,'2 Scheiben',60),'1 × 2 Scheiben · 60 g');
  assert.equal(portionQuantity(2,'1 kleine Kartoffel',160),'2 × kleine Kartoffel · 160 g');
  assert.equal(portionQuantity(2,'constructor',20),'2 × constructor · 20 g');
  assert.equal(portionNameLabel('1 Xylitportion'),'Xylitportion');assert.equal(portionNameLabel('1 × Becher'),'Becher');
  assert.equal(portionQuantity(2,'1 Becher'),'2 Becher');assert.equal(portionQuantity(NaN,'1 Becher'),'—');
});

test('historical entry quantities use recorded grams and snapshot labels without mutating data',()=>{
  const snapshot={portionName:'1 Becher',portionGrams:999};const entry={foodSnapshot:snapshot,amount:2,unit:'portion',grams:300};
  const before=structuredClone(entry);assert.equal(entryQuantity(entry),'2 Becher · 300 g');assert.deepEqual(entry,before);
  assert.equal(entryQuantity({...entry,foodSnapshot:{...snapshot,portionName:'Klein'},grams:160}),'2 × Klein · 160 g');
});

test('legacy grams and configured nonportion units retain their existing display',()=>{
  const base={foodSnapshot:{portionName:'1 Becher'},grams:300};
  assert.equal(entryQuantity(base),'300 g');assert.equal(entryQuantity({...base,amount:300,unit:'g'}),'300 g');
  assert.equal(entryQuantity({...base,amount:0.3,unit:'kg'}),'0,3 kg (300 g)');
  assert.equal(entryQuantity({...base,amount:250,unit:'ml',grams:275}),'250 ml (275 g)');
  assert.equal(portionUnitLabel(2,'1 Becher'),'Becher');assert.equal(portionUnitLabel(2,'Klein'),'× Klein');
});
