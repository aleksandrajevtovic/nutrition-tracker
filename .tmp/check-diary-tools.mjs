import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const origin = 'http://127.0.0.1:4178';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {windowsHide: true, stdio: 'pipe'});
let browser;
try {
  let available = false;
  for (let i = 0; i < 100; i++) {
    try {if ((await fetch(origin)).ok) {available = true; break;}} catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(available);
  browser = await chromium.launch({channel: 'msedge', headless: true});
  await mkdir('.tmp/diary-tools', {recursive: true});
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
    const shift = (date, n) => {const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);};
    await page.goto(origin);
    await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    const date = await page.getByLabel('Datum', {exact: true}).inputValue();
    const yesterday = shift(date, -1), olderDate = shift(date, -2);
    const old = {id: 'potato', name: 'Kartoffel früher', brand: 'Bio', kcal: 77, protein: 2, carbs: 17, fat: .1, fiber: 2.2, sugar: .8, portionName: 'Mittel', portionGrams: 150, createdAt: date + 'T00:00:00Z'};
    const current = {...old, name: 'Kartoffel', kcal: 100, portionGrams: 160, portions: [{name: 'Klein', grams: 90}]};
    const oil = {...old, id: 'oil', name: 'Olivenöl', kcal: 900, gramsPerMl: 1};
    const entries = [
      {id: 'latest', foodId: old.id, date: yesterday, meal: 'Mittagessen', amount: 2, unit: 'portion', grams: 160, foodSnapshot: {...old, portionName: 'Klein', portionGrams: 80}, note: 'Nur gestern mit Kräutern', createdAt: date + 'T12:00:00Z'},
      {id: 'old-today', foodId: old.id, date, meal: 'Frühstück', amount: 1, unit: 'portion', grams: 150, foodSnapshot: old, note: 'Heute nach Training', createdAt: date + 'T09:00:00Z'},
      {id: 'oil-today', foodId: oil.id, date, meal: 'Mittagessen', amount: 100, unit: 'ml', grams: 92, foodSnapshot: {...oil, gramsPerMl: .92}, createdAt: date + 'T10:00:00Z'},
      {id: 'deleted', foodId: 'gone', date: olderDate, meal: 'Eigene Mahlzeit', grams: 80, foodSnapshot: {...old, id: 'gone', name: 'Gelöschtes Produkt'}, note: 'Nach dem Spaziergang', createdAt: date + 'T08:00:00Z'},
    ];
    const backup = {version: 1, exportedAt: new Date().toISOString(), foods: [current, oil], entries};
    await page.locator('nav').getByRole('button', {name: 'Datensicherung'}).click();
    await page.locator('input[type="file"]').setInputFiles({name: 'history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))});
    await page.locator('.toast').filter({hasText: 'Datensicherung erfolgreich importiert.'}).waitFor();
    await dismiss();
    await page.locator('nav').getByRole('button', {name: 'Tagebuch'}).click();
    await page.getByRole('button', {name: 'Lebensmittel hinzufügen', exact: true}).click();
    await page.getByRole('button', {name: 'Kartoffel mit letzter Menge auswählen', exact: true}).waitFor();
    assert.equal(await page.locator('.recent-foods__item').count(), 2);
    assert.match(await page.locator('.recent-foods__item').first().innerText(), /2 × Klein · 180 kcal/);
    await page.getByRole('button', {name: 'Kartoffel mit letzter Menge auswählen', exact: true}).click();
    assert.equal(await page.getByLabel('Menge', {exact: true}).inputValue(), '2');
    assert.equal(await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).inputValue(), '');
    assert.match(await page.locator('.preview').innerText(), /180 kcal/);
    await page.getByLabel('Mahlzeit', {exact: true}).selectOption('Abendessen');
    await layout();
    await page.getByRole('button', {name: 'Kartoffel erneut hinzufügen', exact: true}).click();
    await page.locator('.diary-entry-editor').waitFor({state: 'hidden'});
    assert.equal(await page.locator('.entry').count(), 3);
    await dismiss();
    const added = page.locator('.entry').filter({has: page.locator('.diary-entry__name', {hasText: /^Kartoffel$/})});
    await added.locator('.diary-entry__toggle').click();
    assert.equal(await added.locator('.diary-entry__note').count(), 0);
    await added.getByLabel('Menge für Kartoffel', {exact: true}).fill('0,5');
    assert.match(await added.locator('.quick-quantity .hint').innerText(), /45 g · 45 kcal/);
    await added.getByRole('button', {name: 'Menge speichern', exact: true}).click();
    await page.locator('.toast').filter({hasText: 'Menge aktualisiert.'}).waitFor();
    await dismiss();
    assert.match(await added.locator('.diary-entry__quantity').innerText(), /0,5 × Klein \(45 g\)/);
    await added.getByLabel('Menge für Kartoffel', {exact: true}).fill('0');
    assert.equal(await added.getByRole('button', {name: 'Menge speichern', exact: true}).isDisabled(), true);
    await added.getByLabel('Menge für Kartoffel', {exact: true}).fill('0,5');
    const historical = page.locator('.entry').filter({has: page.locator('.diary-entry__name', {hasText: /^Kartoffel früher$/})});
    await historical.locator('.diary-entry__toggle').click();
    await historical.getByLabel('Menge für Kartoffel früher', {exact: true}).fill('2');
    await historical.getByRole('button', {name: 'Menge speichern', exact: true}).click();
    await page.locator('.toast').filter({hasText: 'Menge aktualisiert.'}).waitFor();
    await dismiss();
    assert.match(await historical.locator('.diary-entry__quantity').innerText(), /300 g/);
    assert.match(await historical.locator('.diary-entry__calories').innerText(), /231/);
    assert.match(await historical.locator('.diary-entry__note').innerText(), /Heute nach Training/);
    await layout();
    await page.getByRole('button', {name: 'Tagebuchsuche', exact: true}).click();
    await page.getByLabel('Suchbegriff', {exact: true}).fill('spaziergang');
    await page.locator('.diary-search__result').waitFor();
    assert.equal(await page.locator('.diary-search__result').count(), 1);
    assert.match(await page.locator('.diary-search__result').innerText(), /Gelöschtes Produkt/);
    await layout();
    await page.screenshot({path: `.tmp/diary-tools/search-${viewport.width}.png`});
    await page.locator('.diary-search__result').getByRole('button').click();
    await page.getByRole('heading', {name: 'Eintrag bearbeiten', exact: true}).waitFor();
    assert.equal(await page.getByLabel('Datum', {exact: true}).inputValue(), olderDate);
    assert.equal(await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).inputValue(), 'Nach dem Spaziergang');
    await page.getByLabel('Notiz zum Eintrag (optional)', {exact: true}).fill('Wiedergefunden');
    await page.getByRole('button', {name: 'Änderungen speichern', exact: true}).click();
    await page.locator('.diary-entry-editor').waitFor({state: 'hidden'});
    await dismiss();
    assert.equal(await page.locator('.entry').count(), 1);
    await page.getByRole('button', {name: 'Tagebuchsuche', exact: true}).click();
    await page.getByLabel('Suchbegriff', {exact: true}).fill('spaziergang');
    await page.getByText('Keine passenden Einträge gefunden.', {exact: true}).waitFor();
    await page.getByLabel('Suchbegriff', {exact: true}).fill('BIO geloschtes');
    await page.locator('.diary-search__result').waitFor();
    await page.getByLabel('Suche ab Datum (optional)', {exact: true}).fill(date);
    assert.equal(await page.locator('.diary-search__result').count(), 0);
    await page.getByLabel('Suche bis Datum (optional)', {exact: true}).fill(olderDate);
    await page.getByRole('alert').filter({hasText: 'gültigen Zeitraum'}).waitFor();
    await page.getByLabel('Suche ab Datum (optional)', {exact: true}).fill(olderDate);
    assert.equal(await page.locator('.diary-search__result').count(), 1);
    await page.getByRole('button', {name: 'Tagebuchsuche schließen'}).click();
    await page.getByRole('button', {name: 'Kompakt', exact: true}).click();
    await page.getByRole('button', {name: 'Menge für Gelöschtes Produkt ändern', exact: true}).click();
    await page.getByLabel('Menge für Gelöschtes Produkt', {exact: true}).fill('100');
    await page.getByRole('button', {name: 'Menge speichern', exact: true}).click();
    await page.locator('.toast').filter({hasText: 'Menge aktualisiert.'}).waitFor();
    await dismiss();
    assert.match(await page.locator('.entry').innerText(), /100 g · 77 kcal/);
    assert.match(await page.locator('.diary-entry__note').innerText(), /Wiedergefunden/);
    await layout();
    await page.reload();
    await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    await page.locator('nav').getByRole('button', {name: 'Datensicherung'}).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', {name: 'JSON-Datensicherung herunterladen', exact: true}).click();
    const download = await downloading;
    const saved = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(saved.entries.length, 5);
    assert.equal(saved.entries.find(entry => entry.id === 'old-today').grams, 300);
    assert.equal(saved.entries.find(entry => entry.id === 'old-today').note, 'Heute nach Training');
    assert.equal(saved.entries.find(entry => entry.id === 'deleted').grams, 100);
    assert.equal(saved.entries.find(entry => entry.id === 'deleted').unit, 'g');
    const repeated = saved.entries.find(entry => !entries.some(original => original.id === entry.id));
    assert.equal(repeated.grams, 45);
    assert.equal(repeated.foodSnapshot.kcal, 100);
    assert.equal(repeated.meal, 'Abendessen');
    assert.equal(repeated.note, undefined);
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width} × ${viewport.height}: recent selection/direct add/current product values; search notes/deleted products/date filters/open historical editor; quick quantities in both views, German decimals, historical nutrition/notes preserved; backup/reload; no overflow`);
    await context.close();
  }
} finally {if (browser) await browser.close(); server.kill();}
