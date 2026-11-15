import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const origin = 'http://127.0.0.1:4186/nutrition-tracker/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4186', '--strictPort'], {windowsHide: true, stdio: 'pipe'});
let browser;
try {
  for (let i = 0; i < 100; i++) {try {if ((await fetch(origin)).ok) break;} catch {} await new Promise(resolve => setTimeout(resolve, 100));}
  browser = await chromium.launch({channel: 'msedge', headless: true}); await mkdir('.tmp/meal-add', {recursive: true});
  for (const viewport of [{width: 320, height: 740}, {width: 375, height: 812}, {width: 768, height: 1024}, {width: 1024, height: 800}, {width: 1440, height: 900}, {width: 568, height: 320}].filter(value => !process.argv[2] || value.width === Number(process.argv[2]))) {
    const context = await browser.newContext({viewport, locale: 'de-DE', reducedMotion: 'reduce'});
    const page = await context.newPage(); const errors = [], dialogs = []; let accept = true;
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', async dialog => {dialogs.push(dialog.message()); if (accept) await dialog.accept(); else await dialog.dismiss();});
    async function dismiss() {while (await page.getByRole('button', {name: 'Benachrichtigung schließen'}).count()) await page.getByRole('button', {name: 'Benachrichtigung schließen'}).first().click();}
    async function layout() {
      const result = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('main *, nav')].filter(el => {if (el.closest('.meal-filter__list')) return false; const box = el.getBoundingClientRect(); return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1) && getComputedStyle(el).position !== 'absolute';}).slice(0, 5).map(el => el.className)}));
      assert.ok(result.scroll <= result.width + 1, JSON.stringify(result)); assert.deepEqual(result.overflow, [], JSON.stringify(result));
    }
    const add = meal => page.getByRole('button', {name: `Lebensmittel zu ${meal} hinzufügen`, exact: true});
    await page.goto(origin); await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    const date = await page.getByLabel('Datum', {exact: true}).inputValue();
    const custom = 'Meine eigene Mahlzeit nach dem Training';
    const food = {id: 'own', name: 'Eigenes Lebensmittel', brand: '', kcal: 100, protein: 10, carbs: 20, fat: 1, fiber: 2, sugar: 3, portionName: '1 Portion', portionGrams: 100, createdAt: date + 'T00:00:00Z'};
    const entries = ['Frühstück', 'Abendessen', custom].map((meal, i) => ({id: `entry-${i}`, foodId: food.id, date, meal, grams: 100, foodSnapshot: food, createdAt: date + `T0${i}:00:00Z`}));
    await page.locator('nav').getByRole('button', {name: 'Datensicherung', exact: true}).click();
    await page.locator('input[type="file"]').setInputFiles({name: 'meals.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({version: 1, exportedAt: food.createdAt, foods: [food], entries}))});
    await page.locator('.toast').filter({hasText: 'Datensicherung erfolgreich importiert.'}).waitFor(); await dismiss();
    await page.locator('nav').getByRole('button', {name: 'Tagebuch', exact: true}).click();
    await add('Frühstück').waitFor(); await layout();
    await page.locator('.meal').first().screenshot({path: `.tmp/meal-add/header-${viewport.width}.png`});
    await add('Frühstück').click();
    assert.equal(await page.getByLabel('Mahlzeit', {exact: true}).inputValue(), 'Frühstück');
    await page.waitForFunction(() => {const title = document.querySelector('.diary-entry-editor h3'); const bar = document.querySelector('.meal-filter').getBoundingClientRect(); return title && title.getBoundingClientRect().top >= bar.bottom && document.activeElement === title;});
    await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).fill('Entwurf behalten');
    accept = false; const before = dialogs.length; await add('Abendessen').click();
    assert.equal(dialogs.length, before + 1);
    assert.equal(await page.getByLabel('Mahlzeit', {exact: true}).inputValue(), 'Frühstück');
    assert.equal(await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).inputValue(), 'Entwurf behalten');
    accept = true; await add('Abendessen').click();
    assert.equal(await page.getByLabel('Mahlzeit', {exact: true}).inputValue(), 'Abendessen');
    assert.equal(await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).inputValue(), '');
    await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).fill('Für Abendessen');
    await page.getByRole('button', {name: 'Lebensmittel hinzufügen', exact: true}).click();
    assert.equal(await page.getByLabel('Mahlzeit', {exact: true}).inputValue(), 'Abendessen');
    assert.equal(await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).inputValue(), 'Für Abendessen');
    await page.locator('.food-picker__trigger').click();
    await page.getByRole('combobox', {name: 'Lebensmittel suchen'}).fill('Eigenes'); await page.getByRole('combobox', {name: 'Lebensmittel suchen'}).press('Enter');
    await page.getByRole('button', {name: 'Zum Tag hinzufügen', exact: true}).click();
    await page.locator('.diary-entry-editor').waitFor({state: 'hidden'}); await dismiss();
    assert.equal(await page.locator('.meal').filter({has: page.getByRole('heading', {name: 'Abendessen', exact: true})}).locator('.entry').count(), 2);
    assert.equal(await page.getByRole('group', {name: 'Mahlzeiten filtern'}).getByRole('button', {name: /^Alle Mahlzeiten:/}).getAttribute('aria-pressed'), 'true');
    await add(custom).click(); assert.equal(await page.getByLabel('Mahlzeit', {exact: true}).inputValue(), custom);
    await page.getByRole('button', {name: 'Schließen', exact: true}).click();
    await page.getByRole('button', {name: 'Kompakt', exact: true}).click();
    await add('Frühstück').click(); assert.equal(await page.getByLabel('Mahlzeit', {exact: true}).inputValue(), 'Frühstück');
    await page.getByRole('button', {name: 'Schließen', exact: true}).click(); await layout();
    await page.getByRole('group', {name: 'Mahlzeiten filtern'}).getByRole('button', {name: /^Mittagessen:/}).click();
    await page.getByRole('button', {name: 'Zu Mittagessen hinzufügen', exact: true}).click();
    assert.equal(await page.getByLabel('Mahlzeit', {exact: true}).inputValue(), 'Mittagessen');
    await page.getByRole('button', {name: 'Schließen', exact: true}).click();
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width} × ${viewport.height}: meal + in compact/standard/custom/empty meals; correct add/save destination; draft cancellation/discard; global add preserves active draft; reveal below sticky bar; no overflow/errors`);
    await context.close();
  }
} finally {if (browser) await browser.close(); server.kill();}
