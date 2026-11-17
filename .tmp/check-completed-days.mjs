import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4197/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4197','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});await mkdir('.tmp/completed-days',{recursive:true});
  for(const viewport of [{width:320,height:740},{width:375,height:812},{width:768,height:1024},{width:1024,height:800},{width:1440,height:900},{width:568,height:320}].filter(v=>!process.argv[2]||v.width===Number(process.argv[2]))){
    const context=await browser.newContext({viewport,locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='settings'&&args[1]==='completedDays'&&window.__failCompletion){window.__failCompletion=false;throw new DOMException('Test failure','QuotaExceededError');}return put.apply(this,args);};});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
    const tab=name=>page.locator('nav').getByRole('button',{name,exact:true});
    const dismiss=async()=>{while(await page.getByRole('button',{name:'Benachrichtigung schließen'}).count())await page.getByRole('button',{name:'Benachrichtigung schließen'}).first().click();};
    const food={id:'food',name:'Testlebensmittel',brand:'',kcal:200,protein:20,carbs:0,fat:12,fiber:2,sugar:0,portionName:'1 Portion',portionGrams:100,createdAt:'2026-11-17T00:00:00Z'};
    const entry=(date,grams,fiber=2)=>({id:date,foodId:food.id,foodSnapshot:{...food,fiber},date,meal:'Frühstück',grams,amount:grams,unit:'g',createdAt:food.createdAt});
    const note={date:'2026-11-09',updatedAt:food.createdAt,hunger:'Gut gesättigt',energy:'Viel Energie',training:'Spaziergang',observations:'Notiz bleibt erhalten'};
    const backup={version:6,exportedAt:food.createdAt,foods:[food],entries:[entry('2026-11-09',100),entry('2026-11-10',10,null),entry('2026-11-02',200),entry('2026-11-03',1)],weights:[{date:'2026-11-10',kg:72.4,updatedAt:food.createdAt}],goals:{},templates:[],plans:[],shoppingList:{items:[],updatedAt:null},dailyNotes:[note],drinks:[{id:'water',date:'2026-11-10',time:'10:00',name:'Wasser',ml:250,createdAt:food.createdAt}]};
    const importBackup=async data=>{await tab('Datensicherung').click();await page.locator('input[type=file]').setInputFiles({name:'week.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.locator('.toast').filter({hasText:'Datensicherung erfolgreich importiert.'}).waitFor();await dismiss();};
    const showWeek=async()=>{await tab('Wochenübersicht').click();await page.getByLabel('Datum in der Woche',{exact:true}).fill('2026-11-15');await page.getByRole('checkbox',{name:'Tag vollständig am 09.11.2026',exact:true}).waitFor();};
    const mark=date=>page.getByRole('checkbox',{name:`Tag vollständig am ${date}`,exact:true});
    const filter=()=>page.getByRole('checkbox',{name:'Nur vollständige Tage im Nährwertdurchschnitt',exact:true});
    const average=label=>page.locator('.weekly-average').filter({has:page.locator(':scope > span',{hasText:`Ø ${label}`})}).locator(':scope > strong');
    const value=async(label,text)=>{await page.waitForFunction(({label,text})=>[...document.querySelectorAll('.weekly-average')].some(el=>el.querySelector(':scope > span')?.textContent===`Ø ${label}`&&el.querySelector(':scope > strong')?.textContent===text),{label,text});};
    await page.goto(origin);await importBackup(backup);await showWeek();assert.equal(await filter().isChecked(),false);await value('Kalorien','110 kcal');
    await filter().check();await value('Kalorien','—');await page.getByText('Noch kein vollständig erfasster Tag mit Lebensmitteln in dieser Woche.',{exact:false}).waitFor();
    await mark('15.11.2026').check();await page.locator('.toast').filter({hasText:'Tag als vollständig erfasst markiert.'}).waitFor();await value('Kalorien','—');await dismiss();
    const monday=page.locator('.weekly-day').first();await monday.locator('.weekly-day__nutrition summary').click();await monday.locator('.weekly-note-toggle').click();
    await mark('09.11.2026').check();await value('Kalorien','200 kcal');assert.equal(await monday.locator('.weekly-day__nutrition').getAttribute('open'),'');assert.equal(await monday.locator('.weekly-day-note').isVisible(),true);await value('Ballaststoffe','2 g');await value('Gewicht','72,4 kg');await value('Trinkmenge','0,25 l');
    await dismiss();await page.getByRole('button',{name:'Vorherige Woche',exact:true}).click();await mark('02.11.2026').check();await value('Kalorien','400 kcal');await dismiss();await page.getByRole('button',{name:'Nächste Woche',exact:true}).click();await value('Kalorien','200 kcal');await page.locator('.weekly-average').filter({hasText:'Ø Kalorien'}).getByText('-200 kcal zur Vorwoche (Ø)',{exact:true}).waitFor();
    await filter().uncheck();await value('Kalorien','110 kcal');await value('Ballaststoffe','Unvollständig');await filter().check();await value('Kalorien','200 kcal');
    await page.getByRole('button',{name:'09.11.2026 im Tagebuch öffnen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.diary-completion input')?.checked===true);await mark('09.11.2026').uncheck();await dismiss();await showWeek();await value('Kalorien','—');assert.equal(await mark('09.11.2026').isChecked(),false);
    if(viewport.width===320){await page.evaluate(()=>window.__failCompletion=true);await mark('09.11.2026').click();await page.locator('.toast--error').waitFor();assert.equal(await mark('09.11.2026').isChecked(),false);await value('Kalorien','—');await dismiss();}
    await mark('09.11.2026').check();await value('Kalorien','200 kcal');await dismiss();
    await page.reload();await showWeek();assert.equal(await filter().isChecked(),true);assert.equal(await mark('09.11.2026').isChecked(),true);await value('Kalorien','200 kcal');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false);await page.screenshot({path:`.tmp/completed-days/filter-${viewport.width}.png`});await page.locator('.weekly-day').first().scrollIntoViewIfNeeded();await page.screenshot({path:`.tmp/completed-days/cards-${viewport.width}.png`});
    await tab('Datensicherung').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'JSON-Datensicherung herunterladen',exact:true}).click();const file=await download;const saved=JSON.parse(await readFile(await file.path(),'utf8'));assert.deepEqual(saved.completedDays,['2026-11-02','2026-11-09','2026-11-15']);assert.deepEqual(saved.entries,[...backup.entries].sort((a,b)=>a.id.localeCompare(b.id)));await dismiss();
    await importBackup(backup);await showWeek();assert.equal(await mark('09.11.2026').isChecked(),true);await value('Kalorien','200 kcal');
    await importBackup({...saved,completedDays:[]});await showWeek();assert.equal(await mark('09.11.2026').isChecked(),false);await value('Kalorien','—');
    await importBackup(saved);await showWeek();assert.equal(await mark('09.11.2026').isChecked(),true);await value('Kalorien','200 kcal');
    assert.deepEqual(errors,[]);console.log(`PASS ${viewport.width}x${viewport.height}: mark/unmark, empty day, filtered averages/previous week/fibre, independent hydration/weight, open details/notes, diary sync, reload/preference, backup legacy/clear/restore, unchanged entries, no overflow${viewport.width===320?', storage error retains state':''}`);await context.close();
  }
}finally{await browser?.close();server.kill();}
