import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const origin = 'http://127.0.0.1:4179';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {windowsHide: true, stdio: 'pipe'});
let browser;
try {
  let available = false;
  for (let i = 0; i < 100; i++) {
    try {if ((await fetch(origin)).ok) {available = true; break;}} catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(available);
  browser = await chromium.launch({channel: 'msedge', headless: true});
  await mkdir('.tmp/hydration', {recursive: true});
  for (const viewport of [{width: 320, height: 740}, {width: 375, height: 812}, {width: 768, height: 1024}, {width: 1024, height: 800}, {width: 1440, height: 900}, {width: 568, height: 320}].filter(value => !process.argv[2] || value.width === Number(process.argv[2]))) {
    const context = await browser.newContext({viewport, locale: 'de-DE', reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    async function dismiss() {while (await page.getByRole('button', {name: 'Benachrichtigung schließen'}).count()) await page.getByRole('button', {name: 'Benachrichtigung schließen'}).first().click();}
    async function layout() {
      const result = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('main *, nav')].filter(el => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1) && getComputedStyle(el).position !== 'absolute';
        }).slice(0, 5).map(el => ({class: el.className, text: el.textContent.slice(0, 40)}))}));
      assert.ok(result.scroll <= result.width + 1, JSON.stringify(result));
      assert.deepEqual(result.overflow, [], JSON.stringify(result));
    }
    async function total(value) {
      await page.waitForFunction(expected => document.querySelector('.hydration__title strong')?.textContent === expected, value);
    }
    async function added() {await page.locator('.toast').filter({hasText: 'Getränk hinzugefügt.'}).waitFor(); await dismiss();}
    await page.goto(origin);
    await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    const date = await page.getByLabel('Datum', {exact: true}).inputValue();
    const next = new Date(date + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1); const tomorrow = next.toISOString().slice(0, 10);
    await total('0 l');
    assert.equal(await page.getByRole('button', {name: 'Trinkverlauf aufklappen'}).getAttribute('aria-expanded'), 'false');
    await page.getByRole('button', {name: '250 ml Wasser hinzufügen', exact: true}).click(); await added(); await total('0,25 l');
    await page.getByRole('button', {name: '500 ml Wasser hinzufügen', exact: true}).click(); await added(); await total('0,75 l');
    await layout();
    await page.locator('.hydration').scrollIntoViewIfNeeded();
    await page.screenshot({path: `.tmp/hydration/compact-${viewport.width}.png`});
    await page.getByRole('button', {name: 'Trinkverlauf aufklappen'}).click();
    await page.getByLabel('Getränk', {exact: true}).fill('Tee');
    await page.getByLabel('Einheit der Trinkmenge', {exact: true}).selectOption('l');
    assert.equal(await page.getByLabel('Trinkmenge', {exact: true}).inputValue(), '0,25');
    await page.getByLabel('Trinkmenge', {exact: true}).fill('0,5');
    await page.getByLabel('Uhrzeit des Getränks', {exact: true}).fill('00:00');
    await page.getByRole('button', {name: 'Getränk hinzufügen', exact: true}).click(); await added(); await total('1,25 l');
    assert.equal(await page.locator('.drink-timeline li').count(), 3);
    assert.match(await page.locator('.drink-timeline li').last().innerText(), /Bis dahin: 1,25 l/);
    await page.getByRole('button', {name: 'Tee um 00:00 bearbeiten', exact: true}).click();
    await page.waitForFunction(() => document.activeElement?.textContent === 'Getränk bearbeiten');
    await page.getByLabel('Getränk', {exact: true}).fill('Kräutertee mit einem langen Namen für den Umbruchtest');
    await page.getByLabel('Trinkmenge', {exact: true}).fill('350');
    await page.getByLabel('Uhrzeit des Getränks', {exact: true}).fill('12:30');
    await page.getByRole('button', {name: 'Getränk aktualisieren', exact: true}).click();
    await page.locator('.toast').filter({hasText: 'Getränk aktualisiert.'}).waitFor(); await dismiss(); await total('1,1 l');
    assert.equal(await page.locator('.drink-timeline li').count(), 3);
    await layout();
    const water500 = page.locator('.drink-timeline li').filter({hasText: '500 ml'});
    await water500.getByRole('button', {name: / löschen$/}).click();
    await page.locator('.toast').filter({hasText: 'Getränk gelöscht.'}).waitFor(); await total('0,6 l');
    await page.locator('.toast').getByRole('button', {name: 'Rückgängig', exact: true}).click();
    await page.locator('.toast').filter({hasText: 'Getränk wiederhergestellt.'}).waitFor(); await dismiss(); await total('1,1 l');
    await page.getByLabel('Trinkmenge', {exact: true}).fill('-1');
    await page.getByRole('button', {name: 'Getränk hinzufügen', exact: true}).click();
    await page.locator('.toast--error').filter({hasText: 'positive Trinkmenge'}).waitFor(); await dismiss(); await total('1,1 l');
    await page.getByLabel('Trinkmenge', {exact: true}).fill('250');
    await page.getByLabel('Datum', {exact: true}).fill(tomorrow); await total('0 l');
    await page.getByRole('button', {name: '150 ml Wasser hinzufügen', exact: true}).click(); await added(); await total('0,15 l');
    await page.getByLabel('Datum', {exact: true}).fill(date); await total('1,1 l');
    await page.reload(); await total('1,1 l');
    assert.match(await page.locator('.daily-summary__calories strong').innerText(), /0 kcal/);
    await page.getByRole('button', {name: 'Trinkverlauf aufklappen'}).click();
    assert.equal(await page.locator('.drink-timeline li').count(), 3);
    await page.locator('.drink-timeline').scrollIntoViewIfNeeded();
    await page.screenshot({path: `.tmp/hydration/timeline-${viewport.width}.png`});
    await layout();
    await page.locator('nav').getByRole('button', {name: 'Datensicherung'}).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', {name: 'JSON-Datensicherung herunterladen', exact: true}).click();
    const download = await downloading;
    const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(backup.version, 6);
    assert.equal(backup.drinks.length, 4);
    assert.equal(backup.drinks.filter(drink => drink.date === date).reduce((sum, drink) => sum + drink.ml, 0), 1100);
    const importBackup = async (data, expectedToast) => {
      await page.locator('input[type="file"]').setInputFiles({name: 'trinken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data))});
      await page.locator('.toast').filter({hasText: expectedToast}).waitFor(); await dismiss();
    };
    await dismiss();
    const invalid = structuredClone(backup); invalid.drinks[0].ml = 0;
    await importBackup(invalid, 'Ungültige Trinkdaten');
    const {drinks, ...old} = backup;
    await importBackup({...old, version: 5}, 'Datensicherung erfolgreich importiert.');
    await page.locator('nav').getByRole('button', {name: 'Tagebuch'}).click(); await total('1,1 l');
    await page.locator('nav').getByRole('button', {name: 'Datensicherung'}).click();
    await importBackup({...backup, drinks: []}, 'Datensicherung erfolgreich importiert.');
    await page.locator('nav').getByRole('button', {name: 'Tagebuch'}).click(); await total('0 l');
    await page.locator('nav').getByRole('button', {name: 'Datensicherung'}).click();
    await importBackup(backup, 'Datensicherung erfolgreich importiert.');
    await page.locator('nav').getByRole('button', {name: 'Tagebuch'}).click(); await total('1,1 l');
    await layout();
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width} × ${viewport.height}: quick water/custom litres/German decimals/drinks/times; edit/delete/undo; cumulative timeline; per-day/reload; v6 backup round trip, v5 preservation, invalid import rejection; no overflow`);
    await context.close();
  }
} finally {if (browser) await browser.close(); server.kill();}
