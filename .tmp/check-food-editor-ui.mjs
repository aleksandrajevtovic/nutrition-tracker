import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4190/nutrition-tracker/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4190','--strictPort'],{windowsHide:true,stdio:'pipe'});
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});await mkdir('.tmp/food-editor-ui',{recursive:true});
  for(const viewport of [{width:320,height:740},{width:375,height:812},{width:768,height:1024},{width:1024,height:800},{width:1440,height:900},{width:568,height:320}].filter(value=>!process.argv[2]||value.width===Number(process.argv[2]))) {
    const context=await browser.newContext({viewport,locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let accept=true;page.on('dialog',d=>accept?d.accept():d.dismiss());
    const tab=name=>page.locator('nav').getByRole('button',{name,exact:true});const dialog=()=>page.getByRole('dialog');
    const dismiss=async()=>{while(await page.getByRole('button',{name:'Benachrichtigung schließen'}).count())await page.getByRole('button',{name:'Benachrichtigung schließen'}).first().click();};
    const layout=async()=>{const result=await page.evaluate(()=>{const modal=document.querySelector('.food-editor'),header=document.querySelector('.food-editor__header').getBoundingClientRect(),footer=document.querySelector('.food-editor__footer').getBoundingClientRect(),body=document.querySelector('.food-editor__body');return{width:innerWidth,scroll:document.documentElement.scrollWidth,modal:modal.clientWidth,modalScroll:modal.scrollWidth,body:body.clientWidth,bodyScroll:body.scrollWidth,top:header.top,bottom:footer.bottom};});assert.ok(result.scroll<=result.width+1,JSON.stringify(result));assert.ok(result.modalScroll<=result.modal+1,JSON.stringify(result));assert.ok(result.bodyScroll<=result.body+1,JSON.stringify(result));assert.ok(result.top>=0&&result.bottom<=viewport.height,JSON.stringify(result));};
    await page.goto(origin);await tab('Produkte').click();await page.getByRole('button',{name:'Neu',exact:true}).click();await dialog().getByRole('heading',{name:'Lebensmittel anlegen',exact:true}).waitFor();
    assert.deepEqual(await dialog().locator('.food-editor__section > h3').allTextContents(),['Produkt','Nährwerte','Portionen']);
    assert.equal(await dialog().locator('.food-standard-portion').evaluate(el=>el.open),false);
    assert.equal(await dialog().locator('.food-editor__details').first().evaluate(el=>el.open),false);
    assert.equal(await dialog().locator('.food-editor__details').last().evaluate(el=>el.open),false);
    assert.equal(await dialog().locator('.food-portions__card').count(),1);
    assert.equal(await dialog().locator('.food-editor__nutrients').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
    await layout();await page.screenshot({path:`.tmp/food-editor-ui/top-${viewport.width}.png`});
    await dialog().locator('.food-editor__body').evaluate(el=>el.scrollTop=el.scrollHeight);await layout();await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-field')==='name');assert.equal(await dialog().getByLabel('Name',{exact:true}).getAttribute('aria-invalid'),'true');await dismiss();
    await dialog().getByLabel('Name',{exact:true}).fill('Kartoffel UI');
    await dialog().locator('.food-standard-portion > summary').click();await dialog().getByLabel('Portionsname',{exact:true}).fill('Mittel');await dialog().getByLabel('Gramm pro Portion',{exact:true}).fill('150');
    await dialog().getByLabel('Nährwerte beziehen sich auf',{exact:true}).selectOption('portion');
    for(const [name,value]of [['Kalorien','116'],['Eiweiß','3'],['Kohlenhydrate','25.5'],['Zucker','1.2'],['Fett','0.2'],['Ballaststoffe','3.3']])await dialog().getByLabel(`${name} / Portion (150 g)`,{exact:true}).fill(value);
    for(const [index,name,grams]of [[1,'Klein','80'],[2,'Groß','250']]) {
      await dialog().getByRole('button',{name:'Weitere Portion',exact:true}).click();await page.waitForFunction(index=>document.activeElement?.getAttribute('aria-label')===`Name der Portionsgröße ${index}`,index);
      const card=dialog().locator('.food-portions > .food-portions__card').nth(index-1);await card.getByRole('button',{name,exact:true}).click();assert.equal(await card.getByLabel(`Gramm der Portionsgröße ${index}`,{exact:true}).inputValue(),'');await card.getByLabel(`Gramm der Portionsgröße ${index}`,{exact:true}).fill(grams);
    }
    await dialog().getByLabel('Name der Portionsgröße 2',{exact:true}).fill('Klein');await dialog().locator('.food-portions > .food-portions__card').nth(1).locator('summary').click();
    await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.getAttribute('data-field')==='portions.1.name');
    assert.equal(await dialog().locator('.food-portions > .food-portions__card').nth(1).locator('details').evaluate(el=>el.open),true);
    await dialog().getByLabel('Name der Portionsgröße 2',{exact:true}).fill('Groß');await dismiss();await layout();await page.screenshot({path:`.tmp/food-editor-ui/portions-${viewport.width}.png`});
    accept=false;await page.keyboard.press('Escape');assert.equal(await dialog().count(),1);accept=true;
    await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await dismiss();assert.equal(await page.locator('.food-list .food').count(),1);
    await page.getByRole('button',{name:'Kartoffel UI bearbeiten',exact:true}).click();assert.equal(await dialog().getByLabel('Kalorien / Portion (150 g)',{exact:true}).inputValue(),'116');
    assert.equal(await dialog().locator('.food-portions details[open]').count(),0);assert.match(await dialog().locator('.food-portions').innerText(),/Klein\n80 g/);assert.match(await dialog().locator('.food-portions').innerText(),/Groß\n250 g/);
    await dialog().getByLabel('Nährwerte beziehen sich auf',{exact:true}).selectOption('100ml');await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.getAttribute('data-field')==='gramsPerMl');
    await dialog().getByLabel('Gramm pro ml / Dichte (optional)',{exact:true}).fill('1.1');assert.equal(await dialog().getByLabel('Kalorien / 100 ml',{exact:true}).inputValue(),'116');
    await dialog().locator('.food-editor__details').first().locator('summary').click();await dialog().getByLabel('Gramm pro Stück (optional)',{exact:true}).fill('75');await dialog().locator('.food-editor__details').first().locator('summary').click();
    await dialog().locator('.food-editor__details').last().locator('summary').click();await dialog().getByLabel('Barcode (optional)',{exact:true}).fill('bad');await dialog().locator('.food-editor__details').last().locator('summary').click();await dismiss();
    await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.getAttribute('data-field')==='barcode');assert.equal(await dialog().locator('.food-editor__details').last().evaluate(el=>el.open),true);
    await dialog().getByLabel('Barcode (optional)',{exact:true}).fill('4006381333931');await dismiss();await dialog().getByRole('button',{name:'Produkt speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await dismiss();
    await tab('Datensicherung').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'JSON-Datensicherung herunterladen',exact:true}).click();const file=await pending;const backup=JSON.parse(await readFile(await file.path(),'utf8'));assert.equal(backup.foods.length,1);const saved=backup.foods[0];assert.equal(saved.pieceGrams,75);assert.equal(saved.barcode,'4006381333931');assert.deepEqual(saved.portions,[{name:'Klein',grams:80},{name:'Groß',grams:250}]);assert.ok(Math.abs(saved.kcal-116/1.1)<1e-8);
    assert.deepEqual(errors,[]);console.log(`PASS ${viewport.width}x${viewport.height}: compact layout, fixed controls, focused new portions, name-only suggestions, collapsed-card errors, reopen/normalization, density and barcode reveal, draft protection, backup/no overflow`);await context.close();
  }
}finally{await browser?.close();server.kill();}
