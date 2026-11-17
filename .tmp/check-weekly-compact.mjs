import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4198/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4198','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});await mkdir('.tmp/weekly-compact',{recursive:true});
  for(const viewport of [{width:320,height:740},{width:375,height:812},{width:768,height:1024},{width:1024,height:800},{width:1440,height:900},{width:568,height:320}]){
    const context=await browser.newContext({viewport,locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
    const tab=name=>page.locator('nav').getByRole('button',{name,exact:true});
    const food={id:'food',name:'Testlebensmittel',brand:'',kcal:200,protein:20,carbs:0,fat:12,fiber:null,sugar:0,portionName:'1 Portion',portionGrams:100,createdAt:'2026-11-17T00:00:00Z'};
    const entry={id:'entry',foodId:food.id,foodSnapshot:food,date:'2026-11-09',meal:'Frühstück',grams:100,amount:100,unit:'g',createdAt:food.createdAt};
    const note={date:entry.date,updatedAt:food.createdAt,hunger:'Gut gesättigt',energy:'Viel Energie',training:'Spaziergang',observations:'Erste Zeile\n<b>Nur Text</b>'};
    const backup={version:6,exportedAt:food.createdAt,foods:[food],entries:[entry],weights:[{date:entry.date,kg:72.4,updatedAt:food.createdAt}],goals:{},templates:[],plans:[],shoppingList:{items:[],updatedAt:null},dailyNotes:[note],drinks:[{id:'water',date:entry.date,time:'10:00',name:'Wasser',ml:250,createdAt:food.createdAt},{id:'water-only',date:'2026-11-10',time:'11:00',name:'Wasser',ml:1000,createdAt:food.createdAt}]};
    await page.goto(origin);await tab('Datensicherung').click();await page.locator('input[type=file]').setInputFiles({name:'week.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await page.locator('.toast').filter({hasText:'Datensicherung erfolgreich importiert.'}).waitFor();
    while(await page.getByRole('button',{name:'Benachrichtigung schließen'}).count())await page.getByRole('button',{name:'Benachrichtigung schließen'}).first().click();
    await tab('Wochenübersicht').click();await page.getByLabel('Datum in der Woche',{exact:true}).fill('2026-11-15');
    const cards=page.locator('.weekly-day'),details=page.locator('.weekly-day__nutrition'),main=cards.first().locator('.weekly-day__values');
    await cards.nth(6).waitFor();assert.equal(await details.count(),7);assert.equal(await page.locator('.weekly-day__nutrition[open]').count(),0);
    assert.deepEqual(await main.locator('dt').allTextContents(),['Kalorien','Eiweiß','Trinkmenge','Gewicht']);assert.deepEqual(await main.locator('dd').allTextContents(),['200 kcal','20 g','0,25 l','72,4 kg']);
    assert.deepEqual(await cards.nth(1).locator('.weekly-day__values dd').allTextContents(),['—','—','1 l','—']);assert.deepEqual(await cards.nth(2).locator('.weekly-day__values dd').allTextContents(),['—','—','—','—']);
    assert.equal(await details.first().getByText('Kohlenhydrate',{exact:true}).isVisible(),false);
    const summary=details.first().locator('summary');await summary.focus();await page.keyboard.press('Enter');
    assert.equal(await details.first().getAttribute('open'),'');assert.deepEqual(await details.first().locator('dd').allTextContents(),['0 g','12 g','Unvollständig']);
    await cards.first().locator('.weekly-note-toggle').click();assert.equal(await cards.first().locator('.weekly-day-note').isVisible(),true);assert.equal(await details.first().getAttribute('open'),'');
    await details.nth(1).locator('summary').click();assert.equal(await page.locator('.weekly-day__nutrition[open]').count(),2);assert.deepEqual(await details.nth(1).locator('dd').allTextContents(),['—','—','—']);
    await cards.first().getByRole('button',{name:'Tagesnotiz schließen',exact:true}).click();assert.equal(await cards.first().locator('.weekly-note-toggle').evaluate(el=>el===document.activeElement),true);
    await summary.click();assert.equal(await details.first().getAttribute('open'),null);assert.equal(await details.nth(1).getAttribute('open'),'');
    await summary.click();await cards.first().scrollIntoViewIfNeeded();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);assert.equal(overflow,false);
    await page.screenshot({path:`.tmp/weekly-compact/${viewport.width}.png`});
    await page.getByRole('button',{name:'Vorherige Woche',exact:true}).click();await page.getByRole('button',{name:'02.11.2026 im Tagebuch öffnen',exact:true}).waitFor();assert.equal(await page.locator('.weekly-day__nutrition[open]').count(),0);
    await page.getByRole('button',{name:'Nächste Woche',exact:true}).click();await page.getByRole('button',{name:'09.11.2026 im Tagebuch öffnen',exact:true}).waitFor();assert.equal(await page.locator('.weekly-day__nutrition[open]').count(),0);
    await page.getByRole('button',{name:'09.11.2026 im Tagebuch öffnen',exact:true}).click();assert.equal(await page.getByLabel('Datum',{exact:true}).inputValue(),'2026-11-09');
    assert.deepEqual(errors,[]);console.log(`PASS ${viewport.width}x${viewport.height}: four values, missing/zero/incomplete values, keyboard/independent toggles, notes/focus, week reset, diary navigation, no overflow`);await context.close();
  }
}finally{await browser?.close();server.kill();}
