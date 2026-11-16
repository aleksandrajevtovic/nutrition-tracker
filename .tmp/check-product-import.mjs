import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4188/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4188','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  await mkdir('.tmp/product-import',{recursive:true});
  for(const viewport of [{width:320,height:740},{width:375,height:812},{width:768,height:1024},{width:1024,height:800},{width:1440,height:900},{width:568,height:320}].filter(value=>!process.argv[2]||value.width===Number(process.argv[2]))) {
    const context=await browser.newContext({viewport,locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(()=>{
      window.__cameraMode='denied';
      navigator.mediaDevices.getUserMedia=async()=>{
        if(window.__cameraMode==='denied')throw new DOMException('Denied','NotAllowedError');
        const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
        const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1280,720);
        const code='4006381333931',L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
        const parity=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'][Number(code[0])];
        const flip=value=>[...value].map(c=>c==='1'?'0':'1').join('');
        let bars='101';
        for(let i=1;i<=6;i++){const value=L[Number(code[i])];bars+=parity[i-1]==='L'?value:flip([...value].reverse().join(''));}
        bars+='01010';for(let i=7;i<13;i++)bars+=flip(L[Number(code[i])]);bars+='101';
        ctx.fillStyle='black';[...bars].forEach((bit,index)=>{if(bit==='1')ctx.fillRect(450+index*4,220,4,280);});
        const stream=canvas.captureStream(10);window.__cameraStream=stream;window.__cameraCanvas=canvas;
        return stream;
      };
    });
    let requests=0;
    await context.route('https://world.openfoodfacts.org/api/v2/product/**',async route=>{
      requests++;const code=new URL(route.request().url()).pathname.match(/(\d+)\.json/)[1];
      if(code==='96385074')return route.fulfill({status:200,json:{status:0}});
      if(code==='036000291452')return route.fulfill({status:429,json:{}});
      if(code==='5012345678900')return route.abort('failed');
      const liquid=code==='3017620422003';
      return route.fulfill({status:200,json:{status:1,product:{product_name_de:liquid?'Test-Saft':'Test-Hafer',brands:'Testmarke',serving_size:liquid?'250 ml':'1 Schale (50 g)',product_quantity_unit:liquid?'ml':'g',nutriments:{'energy-kcal_100g':liquid?45:200,proteins_100g:liquid?0:12,carbohydrates_100g:liquid?10:20,sugars_100g:liquid?10:3,fat_100g:liquid?0:8,...(liquid?{fiber_100g:0}:{})}}}});
    });
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let accept=true,dialogs=0;page.on('dialog',async dialog=>{dialogs++;await(accept?dialog.accept():dialog.dismiss());});
    const tab=name=>page.locator('nav').getByRole('button',{name,exact:true});
    const dialog=()=>page.getByRole('dialog');
    const dismiss=async()=>{while(await page.getByRole('button',{name:'Benachrichtigung schließen'}).count())await page.getByRole('button',{name:'Benachrichtigung schließen'}).first().click();};
    const search=async code=>{await dialog().getByLabel('Barcode (EAN / UPC)',{exact:true}).fill(code);await dialog().getByRole('button',{name:'Produkt suchen',exact:true}).click();};
    const close=async()=>{await dialog().getByRole('button',{name:/^(Produktimport schließen|Schließen)$/}).click();await page.getByRole('dialog').waitFor({state:'hidden'});};
    const layout=async()=>{const sizes=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,modal:[...document.querySelectorAll('.modal')].map(el=>({client:el.clientWidth,scroll:el.scrollWidth}))}));assert.ok(sizes.scroll<=sizes.width+1,JSON.stringify(sizes));for(const modal of sizes.modal)assert.ok(modal.scroll<=modal.client+1,JSON.stringify(sizes));};
    await page.goto(origin);await tab('Produkte').click();await page.getByRole('button',{name:'Produkt scannen',exact:true}).click();
    await dialog().getByRole('button',{name:'Barcode mit Kamera scannen',exact:true}).click();
    await dialog().getByRole('alert').filter({hasText:'Kamerazugriff wurde nicht erlaubt'}).waitFor();
    await search('4006381333932');await dialog().getByRole('alert').filter({hasText:'gültigen'}).waitFor();assert.equal(requests,0);
    await search('4006381333931');await dialog().getByRole('heading',{name:'Lebensmittel anlegen'}).waitFor();
    assert.equal(await dialog().getByLabel('Ballaststoffe / 100 g',{exact:true}).inputValue(),'');
    await dialog().getByLabel('Name',{exact:true}).fill('Mein Hafer');await dialog().getByLabel('Kalorien / 100 g',{exact:true}).fill('250');
    await dialog().getByLabel('Ballaststoffe / 100 g',{exact:true}).fill('3');
    accept=false;await dialog().getByRole('button',{name:'Schließen',exact:true}).click();assert.equal(await dialog().count(),1);accept=true;
    await dialog().getByRole('checkbox').check();await layout();await page.screenshot({path:`.tmp/product-import/review-${viewport.width}.png`});
    await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(await page.locator('.food-list .food').count(),1);assert.match(await page.locator('.food-list').innerText(),/Mein Hafer/);await dismiss();
    await tab('Tagebuch').click();await page.getByRole('button',{name:'Lebensmittel hinzufügen',exact:true}).click();
    const entry=page.locator('.diary-entry-editor');await entry.getByLabel('Mahlzeit',{exact:true}).selectOption('Abendessen');await entry.getByLabel('Notiz zum Eintrag (optional)',{exact:true}).fill('Eigene Notiz');
    await entry.getByRole('button',{name:'Produkt scannen',exact:true}).click();await context.setOffline(true);const before=requests;
    await search('4006381333931');await dialog().getByRole('heading',{name:'Mein Hafer',exact:true}).waitFor();assert.equal(requests,before);
    await dialog().getByRole('button',{name:'Für Eintrag auswählen',exact:true}).click();assert.equal(await entry.getByLabel('Mahlzeit',{exact:true}).inputValue(),'Abendessen');assert.equal(await entry.getByLabel('Notiz zum Eintrag (optional)',{exact:true}).inputValue(),'Eigene Notiz');
    await context.setOffline(false);await entry.getByLabel('Menge',{exact:true}).fill('2');await entry.getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await page.locator('.diary-entry-editor').waitFor({state:'hidden'});
    assert.match(await page.locator('.meal').innerText(),/250 kcal/);await dismiss();
    await page.getByRole('button',{name:'Lebensmittel hinzufügen',exact:true}).click();await entry.getByRole('button',{name:'Produkt scannen',exact:true}).click();
    await search('3017620422003');await dialog().getByRole('heading',{name:'Lebensmittel anlegen'}).waitFor();
    assert.equal(await dialog().getByLabel('Nährwerte beziehen sich auf',{exact:true}).inputValue(),'100ml');assert.equal(await dialog().getByLabel('Gramm pro ml / Dichte (optional)',{exact:true}).inputValue(),'');
    assert.equal(await dialog().getByLabel('Kalorien / 100 ml',{exact:true}).inputValue(),'45');
    await dialog().getByLabel('Gramm pro ml / Dichte (optional)',{exact:true}).fill('1.1');await dialog().locator('.food-standard-portion > summary').click();await dialog().getByLabel('Gramm pro Portion',{exact:true}).fill('275');
    await dialog().getByRole('checkbox').check();await dialog().getByRole('button',{name:'Speichern und zum Tag hinzufügen',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(await entry.getByLabel('Einheit',{exact:true}).inputValue(),'ml');await entry.getByLabel('Menge',{exact:true}).fill('250');assert.match(await entry.locator('.preview').innerText(),/11[23] kcal/);
    await entry.getByRole('button',{name:'Zum Tag hinzufügen',exact:true}).click();await page.locator('.diary-entry-editor').waitFor({state:'hidden'});await dismiss();
    await tab('Produkte').click();assert.equal(await page.locator('.food-list .food').count(),2);await page.getByRole('button',{name:'Produkt scannen',exact:true}).click();
    await search('96385074');await dialog().getByText('Kein Produkt zu diesem Barcode gefunden.',{exact:false}).waitFor();
    await dialog().getByRole('button',{name:'Manuell anlegen',exact:true}).click();assert.equal(await dialog().getByLabel('Barcode (optional)',{exact:true}).inputValue(),'96385074');await close();
    await page.getByRole('button',{name:'Produkt scannen',exact:true}).click();await search('036000291452');await dialog().getByRole('alert').filter({hasText:'Zu viele Produktabfragen'}).waitFor();
    await context.setOffline(true);await search('96385074');await dialog().getByRole('alert').filter({hasText:'Du bist offline'}).waitFor();await context.setOffline(false);await close();await dismiss();
    await page.getByRole('button',{name:'Produkt scannen',exact:true}).click();await page.evaluate(()=>window.__cameraMode='barcode');await dialog().getByRole('button',{name:'Barcode mit Kamera scannen',exact:true}).click();
    await dialog().getByRole('heading',{name:'Mein Hafer',exact:true}).waitFor({timeout:20000});
    assert.equal(await page.evaluate(()=>window.__cameraStream.getTracks().every(track=>track.readyState==='ended')),true);await close();
    await layout();assert.deepEqual(errors,[]);assert.ok(dialogs>0);
    console.log(`PASS ${viewport.width}x${viewport.height}: actual barcode decoding/camera cleanup, permission errors, validation, editable import, draft cancel, offline local match, diary meal/note preservation, density/100ml, not found/manual/limits/offline, no overflow/errors`);
    await context.close();
  }
}finally{await browser?.close();server.kill();}
