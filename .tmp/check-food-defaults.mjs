import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4191/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4191','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const viewport of [{width:375,height:812},{width:1440,height:900}]){
    const context=await browser.newContext({viewport,locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const tab=name=>page.locator('nav').getByRole('button',{name,exact:true});const dialog=()=>page.getByRole('dialog');
    const dismiss=async()=>{while(await page.getByRole('button',{name:'Benachrichtigung schließen'}).count())await page.getByRole('button',{name:'Benachrichtigung schließen'}).first().click();};
    const food={id:'existing',name:'Vorhandenes Produkt',brand:'',portionName:'1 Portion',portionGrams:100,kcal:200,protein:20,carbs:10,sugar:0,fat:0,fiber:0,createdAt:'2026-11-16T00:00:00Z'};
    const entry={id:'history',date:'2026-11-15',meal:'Frühstück',foodId:food.id,grams:150,amount:150,unit:'g',foodSnapshot:{...food},createdAt:food.createdAt};
    const backup={version:6,exportedAt:food.createdAt,foods:[food],entries:[entry],weights:[],goals:{},dailyNotes:[],drinks:[],templates:[],plans:[],shoppingList:{items:[],updatedAt:null}};
    await page.goto(origin);await tab('Datensicherung').click();await page.locator('input[type=file]').setInputFiles({name:'vorhanden.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('.toast').filter({hasText:'Datensicherung erfolgreich importiert.'}).waitFor();await dismiss();
    await tab('Produkte').click();await page.getByRole('button',{name:'Neu',exact:true}).click();
    for(const label of ['Kalorien','Eiweiß','Kohlenhydrate','Zucker','Fett','Ballaststoffe'])assert.equal(await dialog().getByLabel(`${label} / 100 g`,{exact:true}).inputValue(),'');
    await dialog().getByLabel('Name',{exact:true}).fill('Neues Produkt');await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.getAttribute('data-field')==='kcal');assert.equal(await dialog().count(),1);
    for(const[label,value]of [['Kalorien','123'],['Eiweiß','8'],['Kohlenhydrate','2'],['Zucker','0'],['Fett','0'],['Ballaststoffe','0']])await dialog().getByLabel(`${label} / 100 g`,{exact:true}).fill(value);
    await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await dismiss();
    await page.getByRole('button',{name:'Vorhandenes Produkt bearbeiten',exact:true}).click();
    assert.equal(await dialog().getByLabel('Kalorien / 100 g',{exact:true}).inputValue(),'200');assert.equal(await dialog().getByLabel('Fett / 100 g',{exact:true}).inputValue(),'0');
    await dialog().getByLabel('Fett / 100 g',{exact:true}).click();await page.keyboard.press('Tab');assert.equal(await dialog().getByLabel('Fett / 100 g',{exact:true}).inputValue(),'0');
    const kcal=dialog().getByLabel('Kalorien / 100 g',{exact:true});await kcal.click();await kcal.pressSequentially('250');assert.equal(await kcal.inputValue(),'250');
    await dialog().locator('.food-standard-portion > summary').click();const weight=dialog().getByLabel('Gramm pro Portion',{exact:true});await weight.click();await weight.pressSequentially('150');assert.equal(await weight.inputValue(),'150');
    await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await dismiss();
    await page.getByRole('button',{name:'Vorhandenes Produkt bearbeiten',exact:true}).click();assert.equal(await dialog().getByLabel('Kalorien / 100 g',{exact:true}).inputValue(),'250');assert.equal(await dialog().getByLabel('Fett / 100 g',{exact:true}).inputValue(),'0');await dialog().getByRole('button',{name:'Schließen',exact:true}).click();
    await tab('Datensicherung').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'JSON-Datensicherung herunterladen',exact:true}).click();const download=await pending;const saved=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.deepEqual(saved.entries,[entry]);const existing=saved.foods.find(item=>item.id===food.id);assert.equal(existing.kcal,250);assert.equal(existing.portionGrams,150);assert.equal(existing.fat,0);assert.equal(existing.sugar,0);assert.equal(existing.protein,20);assert.equal(saved.foods.length,2);assert.deepEqual(errors,[]);
    console.log(`PASS ${viewport.width}: blank defaults, missing validation, true zeroes, click-and-type replaces existing numbers/portion weight, persistence and unchanged historical diary`);await context.close();
  }
}finally{await browser?.close();server.kill();}
