import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4178/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4178','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const viewport of [{width:320,height:740},{width:375,height:812},{width:768,height:1024},{width:1024,height:800},{width:1440,height:900},{width:568,height:320}].filter(view=>!process.argv[2]||view.width===Number(process.argv[2]))){
    const context=await browser.newContext({viewport,locale:'de-DE',timezoneId:'Europe/Ljubljana',reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(()=>{const del=IDBObjectStore.prototype.delete;IDBObjectStore.prototype.delete=function(...args){if(this.name==='entries'&&window.__failEntryUndo){window.__failEntryUndo=false;throw new DOMException('Failure','QuotaExceededError');}return del.apply(this,args);};});
    const page=await context.newPage(),errors=[];let accept=true,dialogs=0;
    page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>{dialogs++;return accept?dialog.accept():dialog.dismiss();});await page.clock.setFixedTime(new Date('2026-11-18T12:00:00Z'));
    const tab=name=>page.locator('nav').getByRole('button',{name,exact:true}),form=()=>page.locator('.diary-entry-editor > form');
    const toast=text=>page.locator('.toast').filter({hasText:text}),added=()=>toast(/^ErfolgreichJoghurt · .* hinzugefügt\./),undo=target=>target.getByRole('button',{name:'Rückgängig',exact:true});
    const dismiss=async()=>{while(await page.getByRole('button',{name:'Benachrichtigung schließen'}).count())await page.getByRole('button',{name:'Benachrichtigung schließen'}).first().click();};
    const read=()=>page.evaluate(async()=>{const db=await new Promise(resolve=>{const request=indexedDB.open('nutrition-tracker');request.onsuccess=()=>resolve(request.result);});try{return await new Promise(resolve=>{const request=db.transaction('entries').objectStore('entries').getAll();request.onsuccess=()=>resolve(request.result);});}finally{db.close();}});
    const food={id:'yogurt',name:'Joghurt',brand:'',kcal:60,protein:4,carbs:5,sugar:4,fat:2,fiber:null,portionName:'1 Becher',portionGrams:150,createdAt:'2026-11-18T00:00:00Z'};
    const original={id:'original',foodId:food.id,foodSnapshot:structuredClone(food),date:'2026-11-18',meal:'Frühstück',amount:2,unit:'portion',grams:300,note:'Original bleibt erhalten',createdAt:food.createdAt};
    const other={...original,id:'yesterday',date:'2026-11-17'};
    const backup={version:6,exportedAt:food.createdAt,foods:[food],entries:[original,other],weights:[],goals:{},dailyNotes:[],drinks:[],templates:[],plans:[],shoppingList:{items:[],updatedAt:null},completedDays:[]};
    await page.goto(origin);await tab('Datensicherung').click();await page.locator('input[type=file]').setInputFiles({name:'entries.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await toast('Datensicherung erfolgreich importiert.').waitFor();await dismiss();await tab('Tagebuch').click();
    const prepare=async(meal='Frühstück')=>{
      if(!await form().count())await page.getByRole('button',{name:'Lebensmittel hinzufügen',exact:true}).click();
      await form().getByLabel('Mahlzeit',{exact:true}).selectOption(meal);await form().locator('.food-picker__trigger').click();await form().getByRole('option',{name:'Joghurt',exact:true}).click();await form().getByLabel('Einheit',{exact:true}).selectOption('portion');await form().getByLabel('Menge',{exact:true}).fill('2');await form().getByLabel('Notiz zum Eintrag (optional)',{exact:true}).fill('Neue Notiz');
    };
    // Keep-open flow: undo must leave the next draft and its chosen meal untouched.
    await prepare();await form().getByLabel('Einheit',{exact:true}).selectOption('g');await form().getByLabel('Menge',{exact:true}).fill('150');await form().getByRole('button',{name:'Speichern und weiteres hinzufügen',exact:true}).click();await undo(added()).waitFor();
    assert.equal(await added().locator('p').textContent(),'Joghurt · 150 g · Frühstück hinzugefügt.');assert.equal((await read()).length,3);await form().getByLabel('Notiz zum Eintrag (optional)',{exact:true}).fill('Nächster Entwurf');const beforeDialogs=dialogs;
    await undo(added()).click();await toast('Hinzufügen des Eintrags rückgängig gemacht.').waitFor();assert.equal(dialogs,beforeDialogs);assert.equal(await form().getByLabel('Notiz zum Eintrag (optional)',{exact:true}).inputValue(),'Nächster Entwurf');assert.equal(await form().getByLabel('Mahlzeit',{exact:true}).inputValue(),'Frühstück');assert.deepEqual((await read()).sort((a,b)=>a.id.localeCompare(b.id)),[original,other]);await dismiss();
    // Two identical additions: remove only the second, including via recent-food quick actions.
    await prepare('Abendessen');await form().getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await undo(added()).waitFor();const first=(await read()).find(entry=>![original.id,other.id].includes(entry.id));await dismiss();
    await page.getByRole('button',{name:'Lebensmittel hinzufügen',exact:true}).click();await form().getByLabel('Mahlzeit',{exact:true}).selectOption('Abendessen');await form().locator('.recent-foods > summary').click();await form().getByRole('button',{name:'Joghurt erneut hinzufügen',exact:true}).click();await undo(added()).waitFor();assert.equal((await read()).length,4);
    await undo(added()).click();await toast('Hinzufügen des Eintrags rückgängig gemacht.').waitFor();assert.deepEqual((await read()).find(entry=>entry.id===first.id),first);assert.equal((await read()).length,3);await dismiss();
    // Dirty edit on the target must be confirmed; cancelling retains both draft and undo.
    await prepare('Mittagessen');await form().getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await undo(added()).waitFor();
    const lunch=page.getByRole('region',{name:'Mittagessen',exact:true});await lunch.getByRole('button',{name:'Joghurt: Details aufklappen',exact:true}).click();await lunch.getByRole('button',{name:'Joghurt bearbeiten',exact:true}).click();await form().getByLabel('Notiz zum Eintrag (optional)',{exact:true}).fill('Ungespeicherte Änderung');accept=false;
    await undo(added()).click();assert.equal(await form().getByLabel('Notiz zum Eintrag (optional)',{exact:true}).inputValue(),'Ungespeicherte Änderung');assert.equal((await read()).length,4);assert.equal(await undo(added()).count(),1);accept=true;
    await undo(added()).click();await toast('Hinzufügen des Eintrags rückgängig gemacht.').waitFor();assert.equal(await form().count(),0);assert.equal((await read()).length,3);await dismiss();
    // A meal-template draft would disappear with the final entry: protect it as well.
    await prepare('Mittagessen');await form().getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await undo(added()).waitFor();await lunch.getByRole('button',{name:'Mittagessen als Vorlage speichern',exact:true}).click();await page.getByLabel('Name der Vorlage',{exact:true}).fill('Mein Entwurf');accept=false;await undo(added()).click();assert.equal(await page.getByLabel('Name der Vorlage',{exact:true}).inputValue(),'Mein Entwurf');accept=true;await undo(added()).click();await toast('Hinzufügen des Eintrags rückgängig gemacht.').waitFor();assert.equal(await page.getByLabel('Name der Vorlage',{exact:true}).count(),0);await dismiss();
    // Newer saved edits prevent stale undo and leave edit undo available.
    await prepare('Mittagessen');await form().getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await undo(added()).waitFor();await lunch.getByRole('button',{name:'Joghurt: Details aufklappen',exact:true}).click();await lunch.getByRole('button',{name:'Joghurt bearbeiten',exact:true}).click();await form().getByLabel('Menge',{exact:true}).fill('1');await form().getByRole('button',{name:'Änderungen speichern',exact:true}).click();await undo(toast('Eintrag erfolgreich bearbeitet.')).waitFor();
    await undo(added()).click();await page.locator('.toast--error').waitFor();assert.equal((await read()).find(entry=>entry.meal==='Mittagessen').grams,150);await page.locator('.toast--error').getByRole('button',{name:'Benachrichtigung schließen',exact:true}).click();await undo(toast('Eintrag erfolgreich bearbeitet.')).click();await toast('Änderung am Eintrag rückgängig gemacht.').waitFor();await undo(added()).click();await toast('Hinzufügen des Eintrags rückgängig gemacht.').waitFor();await dismiss();
    // Undo after switching days must not navigate away or disturb that day's new draft.
    await prepare();await form().getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await undo(added()).waitFor();await page.getByRole('group',{name:'Tag auswählen',exact:true}).getByRole('button',{name:'Gestern',exact:true}).click();await page.getByRole('button',{name:'Lebensmittel hinzufügen',exact:true}).click();await form().getByLabel('Notiz zum Eintrag (optional)',{exact:true}).fill('Gestern Entwurf');await undo(added()).click();await toast('Hinzufügen des Eintrags rückgängig gemacht.').waitFor();assert.equal(await page.getByLabel('Datum',{exact:true}).inputValue(),'2026-11-17');assert.equal(await form().getByLabel('Notiz zum Eintrag (optional)',{exact:true}).inputValue(),'Gestern Entwurf');await dismiss();
    if(viewport.width===320){
      await prepare();await form().getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await undo(added()).waitFor();const count=(await read()).length;await page.evaluate(()=>window.__failEntryUndo=true);await undo(added()).click();await page.locator('.toast--error').waitFor();assert.equal((await read()).length,count);await page.locator('.toast--error').getByRole('button',{name:'Benachrichtigung schließen',exact:true}).click();await undo(added()).click();await toast('Hinzufügen des Eintrags rückgängig gemacht.').waitFor();assert.equal((await read()).length,count-1);await dismiss();
    }
    assert.deepEqual((await read()).find(entry=>entry.id===original.id),original);assert.deepEqual((await read()).find(entry=>entry.id===other.id),other);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false);
    console.log(`PASS ${viewport.width}x${viewport.height}: new-entry undo, exact duplicate/recent target, keep-open and other-day drafts, dirty-edit/template protection, stale change refusal, edit undo regression, unchanged history/no overflow${viewport.width===320?', failed deletion retry':''}`);await context.close();
  }
} finally {await browser?.close();server.kill();}


