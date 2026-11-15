import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4189/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4189','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:375,height:812},locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('dialog',d=>d.accept());
  page.on('console',message=>console.log('CONSOLE',message.type(),message.text()));
  context.on('request',r=>{if(!r.url().includes('127.0.0.1'))console.log('EXTERNAL REQUEST',r.url());});
  context.on('response',r=>{if(!r.url().includes('127.0.0.1'))console.log('EXTERNAL RESPONSE',r.status(),r.url());});
  page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));
  await page.goto(origin);await page.locator('nav').getByRole('button',{name:'Produkte',exact:true}).click();await page.getByRole('button',{name:'Produkt scannen',exact:true}).click();
  const image=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=750;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1100,750);ctx.fillStyle='black';ctx.font='36px Arial';
    ['Nährwerte pro 100 g','Energie 840 kJ / 200 kcal','Fett 8,5 g','davon gesättigte Fettsäuren 2 g','Kohlenhydrate 20 g','davon Zucker 3,2 g','Ballaststoffe 4 g','Eiweiß 12 g'].forEach((text,index)=>ctx.fillText(text,50,70+index*80));
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Foto der Nährwerttabelle',{exact:true}).setInputFiles({name:'naehrwerte.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  try {await Promise.race([page.getByLabel('Erkannter Text',{exact:true}).waitFor({timeout:45000}),page.getByRole('dialog').getByRole('alert').waitFor({timeout:45000}).then(async()=>{throw Error(await page.getByRole('dialog').innerText());})]);}
  catch(error){await page.screenshot({path:'.tmp/product-import/photo-error.png'});console.log('PHOTO UI',await page.getByRole('dialog').innerText());throw error;}
  const text=await page.getByLabel('Erkannter Text',{exact:true}).inputValue();assert.match(text,/200 kcal/);assert.match(text,/Kohlenhydrate/);
  await page.getByRole('button',{name:'Erkannte Werte prüfen',exact:true}).click();const dialog=page.getByRole('dialog');
  for(const [label,value]of [['Kalorien','200'],['Fett','8.5'],['Kohlenhydrate','20'],['Zucker','3.2'],['Ballaststoffe','4'],['Eiweiß','12']])assert.equal(await dialog.getByLabel(`${label} / 100 g`,{exact:true}).inputValue(),value,label);
  await dialog.getByLabel('Name',{exact:true}).fill('Foto-Produkt');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.food').count(),1);assert.deepEqual(errors,[]);
  console.log('PASS real browser OCR: generated nutrition image, German/English worker initialization, all six nutrients, decimal commas, editable preview, save');
  await page.getByRole('button',{name:'Produkt scannen',exact:true}).click();
  await page.getByLabel('Foto der Nährwerttabelle',{exact:true}).setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await dialog.getByRole('alert').filter({hasText:'Bitte ein Foto'}).waitFor();await dialog.getByRole('button',{name:'Produktimport schließen',exact:true}).click();
  console.log('PASS invalid photo type error');
  await page.getByRole('button',{name:'Produkt scannen',exact:true}).click();
  await dialog.getByLabel('Barcode (EAN / UPC)',{exact:true}).fill('3017620422003');await dialog.getByRole('button',{name:'Produkt suchen',exact:true}).click();
  await dialog.getByRole('heading',{name:'Lebensmittel anlegen'}).waitFor({timeout:25000});
  assert.ok((await dialog.getByLabel('Name',{exact:true}).inputValue()).length>0);assert.ok(Number(await dialog.getByLabel('Kalorien / 100 g',{exact:true}).inputValue())>0);
  console.log('PASS live Open Food Facts barcode query including browser CORS and product mapping');
  await context.close();
}finally{await browser?.close();server.kill();}
