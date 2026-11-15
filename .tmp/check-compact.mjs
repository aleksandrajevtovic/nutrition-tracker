import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const origin = 'http://127.0.0.1:4177';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4177', '--strictPort'], {windowsHide: true, stdio: 'pipe'});
let browser;
try {
  let available = false;
  for (let i = 0; i < 100; i++) {
    try {if ((await fetch(origin)).ok) {available = true; break;}} catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(available);
  browser = await chromium.launch({channel: 'msedge', headless: true});
  await mkdir('.tmp/compact', {recursive: true});
  for (const viewport of [{width: 320, height: 740}, {width: 375, height: 812}, {width: 768, height: 1024}, {width: 1024, height: 800}, {width: 1440, height: 900}, {width: 568, height: 320}].filter(value => !process.argv[2] || value.width === Number(process.argv[2]))) {
    const context = await browser.newContext({viewport, locale: 'de-DE', reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    async function dismiss() {
      while (await page.getByRole('button', {name: 'Benachrichtigung schließen'}).count()) await page.getByRole('button', {name: 'Benachrichtigung schließen'}).first().click();
    }
    async function layout() {
      const result = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('main *, nav')].filter(el => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1) && getComputedStyle(el).position !== 'absolute';
        }).slice(0, 5).map(el => el.className)}));
      assert.ok(result.scroll <= result.width + 1, JSON.stringify(result));
      assert.deepEqual(result.overflow, [], JSON.stringify(result));
    }
    await page.goto(origin);
    await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    assert.equal(await page.getByRole('button', {name: 'Kompakt', exact: true}).getAttribute('aria-pressed'), 'true');
    const date = await page.getByLabel('Datum', {exact: true}).inputValue();
    const food = {id: 'potato', name: 'Kartoffel', brand: 'Eigene Werte', kcal: 77, protein: 2, carbs: 17, fat: .1, fiber: 2.2, sugar: .8, portionName: 'Mittel', portionGrams: 150, createdAt: '2026-11-15T00:00:00Z'};
    const entries = Array.from({length: 24}, (_, i) => ({id: `entry-${i}`, foodId: 'potato', date,
      meal: ['Frühstück', 'Mittagessen', 'Abendessen', 'Meine eigene Mahlzeit'][Math.floor(i / 6)],
      grams: i === 0 ? 150 : 80, ...(i === 0 ? {amount: 1, unit: 'portion'} : {}),
      foodSnapshot: {...food, name: i === 0 ? 'Kartoffel mit einem sehr langen Namen für eine kompakte Zeile' : `Kartoffel ${i + 1}`},
      createdAt: `2026-11-15T00:${String(i).padStart(2, '0')}:00Z`}));
    const backup = {version: 1, exportedAt: new Date().toISOString(), foods: [food], entries};
    await page.locator('nav').getByRole('button', {name: 'Datensicherung'}).click();
    await page.locator('input[type="file"]').setInputFiles({name: 'tagebuch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))});
    await page.locator('.toast').filter({hasText: 'Datensicherung erfolgreich importiert.'}).waitFor();
    await dismiss();
    await page.locator('nav').getByRole('button', {name: 'Tagebuch'}).click();
    await page.getByRole('button', {name: 'Kompakt', exact: true}).click();
    assert.equal(await page.getByRole('button', {name: 'Kompakt', exact: true}).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('.entry').count(), 24);
    const normalHeight = (await page.locator('.meal').first().boundingBox()).height;
    const originalTotal = await page.locator('.daily-summary__calories strong').innerText();
    await page.getByRole('button', {name: 'Kompakt', exact: true}).click();
    assert.equal(await page.getByRole('button', {name: 'Kompakt', exact: true}).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.diary-entry__toggle[aria-expanded="false"]').count(), 24);
    assert.equal(await page.getByRole('button', {name: / bearbeiten$/}).count(), 0);
    const compactHeight = (await page.locator('.meal').first().boundingBox()).height;
    assert.ok(compactHeight < normalHeight * .8, `${compactHeight} not < ${normalHeight} * .8`);
    assert.equal(await page.locator('.daily-summary__calories strong').innerText(), originalTotal);
    await layout();
    await page.locator('.diary-meals').scrollIntoViewIfNeeded();
    await page.screenshot({path: `.tmp/compact/collapsed-${viewport.width}.png`});
    const first = page.locator('.entry').first();
    await first.locator('.diary-entry__toggle').focus();
    await page.keyboard.press('Enter');
    assert.equal(await first.locator('.diary-entry__toggle').getAttribute('aria-expanded'), 'true');
    assert.match(await first.locator('.diary-entry__details').innerText(), /Mittel \(150 g\)/);
    assert.equal(await first.locator('dl div').first().innerText(), 'Protein\n3 g');
    assert.match(await first.locator('.diary-entry__details').innerText(), /Eigene Werte/);
    assert.equal(await first.getByRole('button', {name: / bearbeiten$/}).count(), 1);
    await layout();
    await first.getByRole('button', {name: / bearbeiten$/}).click();
    await page.getByRole('heading', {name: 'Eintrag bearbeiten', exact: true}).waitFor();
    await page.getByLabel('Menge', {exact: true}).fill('2');
    await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).fill('Mit Kräutern\nNach dem Training <b>nur Text</b>');
    await page.getByRole('button', {name: 'Änderungen speichern', exact: true}).click();
    await page.locator('.diary-entry-editor').waitFor({state: 'hidden'});
    assert.equal(await page.locator('.entry').count(), 24);
    assert.match(await first.locator('.diary-entry__details').innerText(), /2 × Mittel \(300 g\)/);
    assert.match(await first.locator('.diary-entry__calories').innerText(), /231/);
    assert.match(await first.locator('.diary-entry__note').innerText(), /Mit Kräutern\nNach dem Training <b>nur Text<\/b>/);
    assert.equal(await first.locator('.diary-entry__note b').count(), 0);
    assert.equal(await first.getByRole('img', {name: 'Notiz vorhanden'}).count(), 1);
    await dismiss();
    const last = page.locator('.entry').last();
    await last.locator('.diary-entry__toggle').click();
    assert.match(await last.locator('.diary-entry__details').innerText(), /80 g/);
    await last.getByRole('button', {name: / löschen$/}).click();
    await page.waitForFunction(() => document.querySelectorAll('.entry').length === 23);
    assert.equal(await page.locator('.entry').count(), 23);
    await page.locator('.toast').getByRole('button', {name: 'Rückgängig', exact: true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.entry').length === 24);
    assert.equal(await page.locator('.entry').count(), 24);
    await dismiss();
    await page.getByRole('button', {name: 'Frühstück als Vorlage speichern', exact: true}).click();
    await page.getByRole('heading', {name: 'Als Vorlage speichern', exact: true}).waitFor();
    await layout();
    await page.getByRole('button', {name: 'Vorlage abbrechen', exact: true}).click();
    await page.getByRole('button', {name: 'Frühstück kopieren', exact: true}).click();
    await page.getByRole('heading', {name: 'Mahlzeit kopieren', exact: true}).waitFor();
    await layout();
    await page.locator('nav').getByRole('button', {name: 'Produkte'}).click();
    await page.locator('nav').getByRole('button', {name: 'Tagebuch'}).click();
    assert.equal(await page.getByRole('button', {name: 'Kompakt', exact: true}).getAttribute('aria-pressed'), 'true');
    await page.getByLabel('Datum', {exact: true}).fill('2099-01-01');
    await page.getByText('Noch keine Einträge', {exact: true}).waitFor();
    assert.equal(await page.getByRole('button', {name: 'Kompakt', exact: true}).getAttribute('aria-pressed'), 'true');
    await page.getByLabel('Datum', {exact: true}).fill(date);
    await page.locator('.entry').first().waitFor();
    assert.equal(await page.locator('.diary-entry__toggle[aria-expanded="true"]').count(), 0);
    await page.reload();
    await page.locator('.entry').first().waitFor();
    assert.equal(await page.getByRole('button', {name: 'Kompakt', exact: true}).getAttribute('aria-pressed'), 'true');
    await first.locator('.diary-entry__toggle').click();
    assert.match(await first.locator('.diary-entry__note').innerText(), /Mit Kräutern/);
    await page.getByRole('button', {name: 'Kompakt', exact: true}).click();
    assert.equal(await page.getByRole('button', {name: / bearbeiten$/}).count(), 24);
    assert.match(await first.locator('.diary-entry__note').innerText(), /Mit Kräutern/);
    await page.reload();
    await page.locator('.entry').first().waitFor();
    assert.equal(await page.getByRole('button', {name: 'Kompakt', exact: true}).getAttribute('aria-pressed'), 'false');
    await page.getByRole('button', {name: 'Lebensmittel hinzufügen', exact: true}).click();
    assert.equal(await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).inputValue(), '');
    await page.locator('.food-picker__trigger').click();
    await page.getByRole('combobox', {name: 'Lebensmittel suchen'}).fill('Kartoffel');
    await page.getByRole('combobox', {name: 'Lebensmittel suchen'}).press('Enter');
    await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).fill('Neue Notiz\nZweite Zeile');
    await layout();
    await page.getByRole('button', {name: 'Zum Tag hinzufügen', exact: true}).click();
    await page.locator('.diary-entry-editor').waitFor({state: 'hidden'});
    const newEntry = page.locator('.entry').filter({has: page.locator('.diary-entry__note', {hasText: 'Neue Notiz'})});
    await newEntry.waitFor();
    await dismiss();
    await newEntry.getByRole('button', {name: / bearbeiten$/}).click();
    assert.equal(await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).inputValue(), 'Neue Notiz\nZweite Zeile');
    await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).fill('');
    await page.getByRole('button', {name: 'Änderungen speichern', exact: true}).click();
    await page.locator('.diary-entry-editor').waitFor({state: 'hidden'});
    assert.equal(await page.locator('.entry').count(), 25);
    assert.equal(await page.locator('.diary-entry__note').filter({hasText: 'Neue Notiz'}).count(), 0);
    await dismiss();
    await page.evaluate(() => {Storage.prototype.setItem = () => {throw new DOMException('Blocked', 'SecurityError');};});
    await page.getByRole('button', {name: 'Kompakt', exact: true}).click();
    assert.equal(await page.getByRole('button', {name: 'Kompakt', exact: true}).getAttribute('aria-pressed'), 'true');
    await page.locator('.toast--error').filter({hasText: 'Auswahl konnte'}).waitFor();
    await layout();
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width} × ${viewport.height}: 24 entries; compact height ${Math.round(compactHeight)}/${Math.round(normalHeight)}; keyboard details, quantities/macros, edit/delete/undo, meal actions, date/tab/reload preference, blocked storage; no overflow`);
    await context.close();
  }
} finally {if (browser) await browser.close(); server.kill();}
