import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], {windowsHide: true, stdio: 'pipe'});
let browser;
try {
  let available = false;
  for (let i = 0; i < 100; i++) {
    try {if ((await fetch('http://127.0.0.1:4176')).ok) {available = true; break;}} catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(available);
  browser = await chromium.launch({channel: 'msedge', headless: true});
  await mkdir('.tmp/food-values', {recursive: true});
  for (const viewport of [{width: 320, height: 740}, {width: 375, height: 812}, {width: 768, height: 1024}, {width: 1024, height: 800}, {width: 1440, height: 900}, {width: 568, height: 320}].filter(value => !process.argv[2] || value.width === Number(process.argv[2]))) {
    const context = await browser.newContext({viewport, locale: 'de-DE', reducedMotion: 'reduce'});
    const page = await context.newPage();
    await page.addInitScript(() => {if (localStorage.getItem('nutrition-tracker:compact-diary') === null) localStorage.setItem('nutrition-tracker:compact-diary', 'false');});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    async function dismiss() {
      while (await page.getByRole('button', {name: 'Benachrichtigung schließen'}).count()) await page.getByRole('button', {name: 'Benachrichtigung schließen'}).first().click();
    }
    async function layout() {
      const result = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('main *, .modal *, nav')].filter(el => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1) && getComputedStyle(el).position !== 'absolute';
        }).slice(0, 5).map(el => el.className)}));
      assert.ok(result.scroll <= result.width + 1, JSON.stringify(result));
      assert.deepEqual(result.overflow, [], JSON.stringify(result));
    }
    const close = (a, b) => assert.ok(Math.abs(Number(a) - b) < 1e-8, `${a} != ${b}`);
    await page.goto('http://127.0.0.1:4176');
    await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    await page.locator('nav').getByRole('button', {name: 'Produkte'}).click();
    await page.getByRole('button', {name: 'Neu', exact: true}).click();
    await page.getByLabel('Name', {exact: true}).fill('Kartoffel Test');
    await page.getByLabel('Portionsname', {exact: false}).fill('Mittel');
    await page.getByLabel('Gramm pro Portion', {exact: true}).fill('150');
    for (const [index, name, grams] of [[1, 'Klein', '80'], [2, 'Groß', '250']]) {
      await page.getByRole('button', {name: 'Portionsgröße hinzufügen'}).click();
      await page.getByLabel(`Name der Portionsgröße ${index}`, {exact: true}).fill(name);
      await page.getByLabel(`Gramm der Portionsgröße ${index}`, {exact: true}).fill(grams);
    }
    await page.getByLabel('Nährwerte beziehen sich auf').selectOption('portion');
    for (const [name, value] of [['Kalorien', '116'], ['Protein', '3'], ['Kohlenhydrate', '25.5'], ['Fett', '.2'], ['Ballaststoffe', '3.3'], ['Zucker', '1.2']]) {
      await page.getByLabel(`${name} / Portion (150 g)`, {exact: true}).fill(value);
    }
    await layout();
    await page.getByRole('button', {name: 'Produkt speichern'}).click();
    await page.getByRole('dialog').waitFor({state: 'hidden'});
    await dismiss();
    await page.getByRole('button', {name: 'Kartoffel Test bearbeiten', exact: true}).click();
    assert.equal(await page.getByLabel('Nährwerte beziehen sich auf').inputValue(), 'portion');
    close(await page.getByLabel('Kalorien / Portion (150 g)', {exact: true}).inputValue(), 116);
    await page.getByLabel('Nährwerte beziehen sich auf').selectOption('100g');
    close(await page.getByLabel('Kalorien / 100 g', {exact: true}).inputValue(), 116 / 150 * 100);
    await page.getByLabel('Nährwerte beziehen sich auf').selectOption('custom');
    assert.equal(await page.getByLabel('Bezugsmenge in g').inputValue(), '150');
    close(await page.getByLabel('Kalorien / 150 g', {exact: true}).inputValue(), 116);
    await page.getByLabel('Nährwerte beziehen sich auf').selectOption('portion');
    await page.getByLabel('Name der Portionsgröße 2', {exact: true}).fill('Klein');
    await page.getByRole('button', {name: 'Produkt speichern'}).click();
    await page.locator('.toast--error').waitFor();
    await dismiss();
    await page.getByLabel('Name der Portionsgröße 2', {exact: true}).fill('Groß');
    await page.locator('.modal').screenshot({path: `.tmp/food-values/editor-${viewport.width}.png`});
    await page.getByRole('button', {name: 'Produkt speichern'}).click();
    await page.getByRole('dialog').waitFor({state: 'hidden'});
    await dismiss();
    await page.locator('nav').getByRole('button', {name: 'Tagebuch'}).click();
    await page.getByRole('button', {name: 'Lebensmittel hinzufügen', exact: true}).click();
    await page.locator('.food-picker__trigger').click();
    await page.getByRole('combobox', {name: 'Lebensmittel suchen'}).fill('Kartoffel Test');
    await page.getByRole('combobox', {name: 'Lebensmittel suchen'}).press('Enter');
    assert.match(await page.locator('.preview').innerText(), /116 kcal/);
    await page.getByLabel('Portionsgröße', {exact: true}).selectOption('Klein');
    assert.match(await page.locator('.preview').innerText(), /62 kcal/);
    await page.getByLabel('Portionsgröße', {exact: true}).selectOption('Groß');
    assert.match(await page.locator('.preview').innerText(), /193 kcal/);
    await page.getByLabel('Menge', {exact: true}).fill('0.5');
    assert.match(await page.locator('.preview').innerText(), /97 kcal/);
    await page.getByLabel('Menge', {exact: true}).fill('1');
    await layout();
    await page.getByRole('button', {name: 'Zum Tag hinzufügen', exact: true}).click();
    await page.locator('.entry').waitFor();
    assert.match(await page.locator('.entry').innerText(), /Groß \(250 g\) · 193 kcal/);
    await dismiss();
    await page.getByRole('button', {name: 'Kartoffel Test bearbeiten', exact: true}).click();
    assert.equal(await page.getByLabel('Portionsgröße', {exact: true}).inputValue(), 'Groß');
    await page.getByLabel('Portionsgröße', {exact: true}).selectOption('Mittel');
    await page.getByRole('button', {name: 'Änderungen speichern', exact: true}).click();
    await page.locator('.diary-entry-editor').waitFor({state: 'hidden'});
    assert.equal(await page.locator('.entry').count(), 1);
    assert.match(await page.locator('.entry').innerText(), /Mittel \(150 g\) · 116 kcal/);
    await dismiss();
    await page.reload();
    await page.locator('.entry').waitFor();
    assert.match(await page.locator('.entry').innerText(), /116 kcal/);
    await page.locator('nav').getByRole('button', {name: 'Produkte'}).click();
    await page.getByRole('button', {name: 'Neues Rezept', exact: true}).click();
    await page.getByLabel('Rezeptname', {exact: true}).fill('Kleine Kartoffeln');
    await page.locator('.food-picker__trigger').click();
    await page.getByRole('combobox', {name: 'Lebensmittel suchen'}).fill('Kartoffel Test');
    await page.getByRole('combobox', {name: 'Lebensmittel suchen'}).press('Enter');
    await page.getByLabel('Einheit der neuen Zutat', {exact: true}).selectOption('portion');
    await page.getByLabel('Portionsgröße', {exact: true}).selectOption('Klein');
    await page.getByLabel('Menge der neuen Zutat', {exact: true}).fill('2');
    await page.getByRole('button', {name: 'Zutat hinzufügen', exact: true}).click();
    assert.equal(await page.getByLabel('Portionsgröße für Zutat 1', {exact: true}).inputValue(), 'Klein');
    await layout();
    await page.getByRole('button', {name: 'Rezept speichern', exact: true}).click();
    await page.getByRole('dialog').waitFor({state: 'hidden'});
    await dismiss();
    await page.getByRole('button', {name: 'Neu', exact: true}).click();
    await page.getByLabel('Name', {exact: true}).fill('Öl Test');
    await page.getByLabel('Gramm pro ml / Dichte (optional)', {exact: true}).fill('0.92');
    await page.getByLabel('Nährwerte beziehen sich auf').selectOption('100ml');
    await page.getByLabel('Kalorien / 100 ml', {exact: true}).fill('884');
    await page.getByRole('button', {name: 'Produkt speichern'}).click();
    await page.getByRole('dialog').waitFor({state: 'hidden'});
    await dismiss();
    await page.locator('nav').getByRole('button', {name: 'Datensicherung'}).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', {name: 'JSON-Datensicherung herunterladen', exact: true}).click();
    const download = await downloading;
    const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
    const potato = backup.foods.find(food => food.name === 'Kartoffel Test');
    assert.equal(potato.portionName, 'Mittel');
    assert.equal(potato.portionGrams, 150);
    assert.equal(potato.nutritionReference.unit, 'portion');
    close(potato.kcal, 116 / 150 * 100);
    close(backup.foods.find(food => food.name === 'Öl Test').kcal, 884 / .92);
    assert.equal(backup.entries[0].grams, 150);
    const recipe = backup.foods.find(food => food.name === 'Kleine Kartoffeln');
    assert.equal(recipe.recipe.ingredients[0].grams, 160);
    assert.equal(recipe.recipe.ingredients[0].foodSnapshot.portionName, 'Klein');
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width} × ${viewport.height}: portion/100g/custom/100ml entry, size selection, duplicate validation, edit/reload, recipe sizes, backup consistency, no overflow`);
    await context.close();
  }
} finally {if (browser) await browser.close(); server.kill();}
