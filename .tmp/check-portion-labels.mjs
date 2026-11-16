import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4195/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4195','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const viewport of [{width:320,height:740},{width:375,height:812},{width:768,height:1024},{width:1024,height:800},{width:1440,height:900},{width:568,height:320}]){
    const context=await browser.newContext({viewport,locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const tab=name=>page.locator('nav').getByRole('button',{name,exact:true});const dismiss=async()=>{while(await page.getByRole('button',{name:'Benachrichtigung schließen'}).count())await page.getByRole('button',{name:'Benachrichtigung schließen'}).first().click();};
    const cup={id:'cup',name:'Joghurt',brand:'',portionName:'1 Becher',portionGrams:150,kcal:100,protein:10,carbs:5,sugar:2,fat:3,fiber:0,createdAt:'2026-11-16T00:00:00Z'};
    const small={...cup,id:'small',name:'Kartoffel',portionName:'Klein',portionGrams:80},slice={...cup,id:'slice',name:'Brot',portionName:'1 Scheibe',portionGrams:40};
    const item=food=>({foodId:food.id,foodSnapshot:food,amount:2,unit:'portion',grams:food.portionGrams*2});
    const ingredients=[{id:'ingredient',amount:2,unit:'portion',grams:300,foodSnapshot:cup}];
    const recipe={...cup,id:'recipe',name:'Joghurt-Rezept',brand:'Eigenes Rezept',portionName:'1 Portion',recipe:{servings:2,yieldGrams:300,autoWeight:true,ingredients,instructions:''}};
    const entries=[cup,small,slice].map(food=>({...item(food),id:food.id,date:'2026-11-16',meal:'Frühstück',createdAt:food.createdAt}));
    const plan={id:'plan',name:'Geplantes Frühstück',date:'2026-11-16',meal:'Frühstück',items:[item(cup),item(small)],createdAt:cup.createdAt,status:'planned',entryIds:[]};
    const backup={version:6,exportedAt:cup.createdAt,foods:[cup,small,slice,recipe],entries,weights:[],goals:{},dailyNotes:[],drinks:[],templates:[],plans:[plan],shoppingList:{items:[],updatedAt:null}};
    await page.goto(origin);await tab('Datensicherung').click();await page.locator('input[type=file]').setInputFiles({name:'portions.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('.toast').filter({hasText:'Datensicherung erfolgreich importiert.'}).waitFor();await dismiss();await tab('Tagebuch').click();await page.getByLabel('Datum',{exact:true}).fill('2026-11-16');
    for(const[name,label]of [['Joghurt','2 Becher · 300 g'],['Kartoffel','2 × Klein · 160 g'],['Brot','2 Scheiben · 80 g']]){await page.getByRole('button',{name:`${name}: Details aufklappen`,exact:true}).click();const entry=page.locator('.diary-entry--compact').filter({has:page.locator('.diary-entry__name',{hasText:name})});assert.equal(await entry.locator('.diary-entry__quantity').innerText(),label);}
    assert.equal(await page.locator('.quick-quantity').first().locator('.quick-quantity__unit').innerText(),'Becher');
    await page.getByRole('button',{name:'Lebensmittel hinzufügen',exact:true}).click();const editor=page.locator('.diary-entry-editor');await editor.locator('.recent-foods summary').click();assert.match(await editor.locator('.recent-foods').innerText(),/2 Becher · 300 g/);assert.match(await editor.locator('.recent-foods').innerText(),/2 × Klein · 160 g/);
    await editor.locator('.food-picker__trigger').click();await page.getByRole('option',{name:'Joghurt',exact:true}).click();await editor.getByLabel('Menge',{exact:true}).fill('2');assert.equal(await editor.locator('.stepper strong').innerText(),'2 Becher');assert.match(await editor.innerText(),/Gewählte Menge: 2 Becher · 300 g/);await editor.getByRole('button',{name:'Schließen',exact:true}).click();
    await page.getByRole('button',{name:'Kompakt',exact:true}).click();assert.match(await page.locator('.meal__content').innerText(),/2 Becher · 300 g/);assert.match(await page.locator('.meal__content').innerText(),/2 × Klein · 160 g/);
    await page.getByRole('button',{name:'Tagebuchsuche',exact:true}).click();await page.locator('.diary-search__result').nth(2).waitFor();assert.match(await page.locator('.diary-search__results').innerText(),/2 Becher · 300 g/);await page.getByRole('button',{name:'Tagebuchsuche schließen',exact:true}).click();
    await tab('Produkte').click();await page.getByRole('button',{name:'Joghurt-Rezept bearbeiten',exact:true}).click();assert.match(await page.locator('.recipe-ingredient').innerText(),/2 Becher · 300 g/);await page.getByRole('button',{name:'Rezept schließen',exact:true}).click();
    await tab('Planen').click();await page.getByRole('button',{name:'Wochenplan',exact:true}).click();await page.getByLabel('Datum im Wochenplan',{exact:true}).fill('2026-11-16');await page.locator('.planning-items').waitFor();assert.match(await page.locator('.planning-items').innerText(),/2 Becher · 300 g/);assert.match(await page.locator('.planning-items').innerText(),/2 × Klein · 160 g/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await tab('Datensicherung').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'JSON-Datensicherung herunterladen',exact:true}).click();const file=await pending;const saved=JSON.parse(await readFile(await file.path(),'utf8'));assert.deepEqual(saved.entries.toSorted((a,b)=>a.id.localeCompare(b.id)),entries.toSorted((a,b)=>a.id.localeCompare(b.id)));assert.deepEqual(saved.plans,[plan]);for(const food of backup.foods)assert.deepEqual(saved.foods.find(value=>value.id===food.id),food);assert.deepEqual(errors,[]);
    console.log(`PASS ${viewport.width}x${viewport.height}: readable units/custom sizes/plurals across compact/full diary, quantity editor, recents/search, recipes/planning; unchanged amounts/snapshots/backup; no overflow/errors`);await context.close();
  }
}finally{await browser?.close();server.kill();}

