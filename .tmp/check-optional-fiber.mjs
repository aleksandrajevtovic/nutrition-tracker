import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4192/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4192','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const viewport of [{width:320,height:740},{width:375,height:812},{width:768,height:1024},{width:1024,height:800},{width:1440,height:900},{width:568,height:320}]){
    const context=await browser.newContext({viewport,locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const tab=name=>page.locator('nav').getByRole('button',{name,exact:true});const dialog=()=>page.getByRole('dialog');
    const dismiss=async()=>{while(await page.getByRole('button',{name:'Benachrichtigung schließen'}).count())await page.getByRole('button',{name:'Benachrichtigung schließen'}).first().click();};
    const download=async name=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const file=await pending;await dismiss();return readFile(await file.path(),'utf8');};
    const layout=async()=>{const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.summary *, .weekly-day *, .weekly-average *')].filter(el=>{const box=el.getBoundingClientRect();return box.width>0&&(box.right>innerWidth+1||box.left< -1);}).map(el=>el.className)}));assert.ok(result.scroll<=result.width+1,JSON.stringify(result));assert.deepEqual(result.overflow,[],JSON.stringify(result));};
    await page.goto(origin);await tab('Produkte').click();await page.getByRole('button',{name:'Neu',exact:true}).click();await dialog().getByLabel('Name',{exact:true}).fill('Optional Test');
    for(const[label,value]of [['Kalorien','200'],['Eiweiß','20'],['Kohlenhydrate','10'],['Zucker','2'],['Fett','4']])await dialog().getByLabel(`${label} / 100 g`,{exact:true}).fill(value);
    const fiber=dialog().getByLabel('Ballaststoffe / 100 g',{exact:true});assert.equal(await fiber.getAttribute('required'),null);assert.equal(await fiber.getAttribute('placeholder'),null);assert.equal(await fiber.inputValue(),'');
    await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await dismiss();assert.match(await page.locator('.food-list').innerText(),/Ballaststoffe: Nicht angegeben/);
    await page.getByRole('button',{name:'Optional Test bearbeiten',exact:true}).click();assert.equal(await fiber.inputValue(),'');await dialog().getByRole('button',{name:'Schließen',exact:true}).click();
    const add=async date=>{await tab('Tagebuch').click();await page.getByLabel('Datum',{exact:true}).fill(date);await page.getByRole('button',{name:'Lebensmittel hinzufügen',exact:true}).click();await page.locator('.food-picker__trigger').click();await page.getByRole('option',{name:'Optional Test',exact:true}).click();await page.getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await page.locator('.diary-entry-editor').waitFor({state:'hidden'});await dismiss();};
    await add('2026-11-16');assert.match(await page.locator('.daily-summary').innerText(),/Unvollständig/);assert.match(await page.locator('.daily-summary__calories').innerText(),/200/);await layout();
    await page.getByRole('button',{name:'Optional Test: Details aufklappen',exact:true}).click();assert.match(await page.locator('.diary-entry__nutrients').innerText(),/Ballaststoffe\nNicht angegeben/);
    await tab('Produkte').click();await page.getByRole('button',{name:'Optional Test bearbeiten',exact:true}).click();await fiber.fill('0');await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await dismiss();await add('2026-11-17');assert.doesNotMatch(await page.locator('.daily-summary').innerText(),/Unvollständig/);
    await tab('Wochenübersicht').click();await page.getByLabel('Datum in der Woche',{exact:true}).fill('2026-11-16');await page.locator('.weekly-day').nth(6).waitFor();
    const days=page.locator('.weekly-day');assert.match(await days.nth(0).innerText(),/Ballaststoffe\nUnvollständig/);assert.match(await days.nth(1).innerText(),/Ballaststoffe\n0 g/);assert.match(await page.locator('.weekly-averages').innerText(),/Ø Ballaststoffe\nUnvollständig/);
    await page.getByRole('combobox',{name:'Tagesvergleich',exact:true}).selectOption('fiber');assert.match(await page.locator('.weekly-bar').nth(0).getAttribute('aria-label'),/Ballaststoffe unvollständig/);assert.equal(await page.locator('.weekly-bar').nth(0).locator('.weekly-bar__fill').count(),0);assert.match(await page.locator('.weekly-bar').nth(1).getAttribute('aria-label'),/0 g/);await layout();
    await tab('Datensicherung').click();const backup=JSON.parse(await download('JSON-Datensicherung herunterladen'));assert.equal(backup.foods[0].fiber,0);assert.equal(backup.entries.find(entry=>entry.date==='2026-11-16').foodSnapshot.fiber,null);assert.equal(backup.entries.find(entry=>entry.date==='2026-11-17').foodSnapshot.fiber,0);
    const daily=(await download('CSV-Tageswerte herunterladen')).trimEnd().split('\r\n').map(row=>row.split(';'));assert.equal(daily[1][6],'');assert.equal(daily[2][6],'0');assert.equal(daily[1][2],'200');
    await page.getByLabel('CSV-Auswertung',{exact:true}).selectOption('weeks');const weekly=(await download('CSV-Wochenwerte herunterladen')).trimEnd().split('\r\n')[1].split(';');assert.equal(weekly[9],'');assert.equal(weekly[5],'200');assert.deepEqual(errors,[]);
    console.log(`PASS ${viewport.width}x${viewport.height}: optional blank/no placeholder, save/reopen, diary unknown vs zero, historical snapshot, weekly/chart completeness, JSON/CSV, no overflow/errors`);await context.close();
  }
}finally{await browser?.close();server.kill();}
