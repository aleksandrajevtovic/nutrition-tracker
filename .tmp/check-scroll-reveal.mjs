import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const origin = 'http://127.0.0.1:4183/nutrition-tracker/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4183', '--strictPort'], {windowsHide: true, stdio: 'pipe'});
let browser;
try {
  for (let i = 0; i < 100; i++) {try {if ((await fetch(origin)).ok) break;} catch {} await new Promise(resolve => setTimeout(resolve, 100));}
  browser = await chromium.launch({channel: 'msedge', headless: true});
  for (const viewport of [{width: 320, height: 740}, {width: 375, height: 812}, {width: 768, height: 1024}, {width: 1024, height: 800}, {width: 1440, height: 900}, {width: 568, height: 320}, {width: 375, height: 812, smooth: true}].filter(value => !process.argv[2] || value.width === Number(process.argv[2]))) {
    const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}, locale: 'de-DE', reducedMotion: viewport.smooth ? 'no-preference' : 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
      window.revealCalls = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options) {window.revealCalls.push({className: this.className, ...options}); return original.call(this, options);};
    });
    const count = () => page.evaluate(() => window.revealCalls.length);
    async function opened(action, selector) {
      const before = await count(); await action();
      await page.waitForFunction(previous => window.revealCalls.length > previous, before);
      await page.waitForFunction(selector => {const el = document.querySelector(selector); const box = el?.getBoundingClientRect(); return box && box.width > 0 && box.top >= -1 && box.bottom < innerHeight - 65;}, selector);
      const call = await page.evaluate(() => window.revealCalls.at(-1));
      assert.equal(call.block, 'start'); assert.equal(call.behavior, viewport.smooth ? 'smooth' : 'instant');
    }
    async function quiet(action) {const before = await count(); await action(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); assert.equal(await count(), before, 'Scrolling repeated while editing/closing/saving');}
    async function dismiss() {while (await page.getByRole('button', {name: 'Benachrichtigung schließen'}).count()) await page.getByRole('button', {name: 'Benachrichtigung schließen'}).first().click();}
    await page.goto(origin); await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    const date = await page.getByLabel('Datum', {exact: true}).inputValue();
    const previousDate = new Date(date + 'T00:00:00Z'); previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    const food = {id: 'own', name: 'Eigenes Lebensmittel', brand: '', kcal: 100, protein: 10, carbs: 20, fat: 1, fiber: 2, sugar: 3, portionName: '1 Portion', portionGrams: 100, createdAt: date + 'T00:00:00Z'};
    const entries = Array.from({length: 4}, (_, i) => ({id: `entry-${i}`, foodId: food.id, date, meal: 'Frühstück', amount: 100, unit: 'g', grams: 100, foodSnapshot: {...food, name: `Eigenes Lebensmittel ${i + 1}`}, createdAt: date + `T0${i}:00:00Z`}));
    const item = {foodId: food.id, amount: 100, unit: 'g', grams: 100, foodSnapshot: food};
    const backup = {version: 6, exportedAt: new Date().toISOString(), foods: [food], entries, goals: {kcal: 2000},
      weights: [{date, kg: 72, updatedAt: food.createdAt}, {date: previousDate.toISOString().slice(0, 10), kg: 73, updatedAt: food.createdAt}],
      templates: [{id: 'template', name: 'Mein Frühstück', meal: 'Frühstück', items: [item], createdAt: food.createdAt}],
      plans: [], shoppingList: {items: [], updatedAt: null}, dailyNotes: [], drinks: []};
    await page.locator('nav').getByRole('button', {name: 'Datensicherung', exact: true}).click();
    await page.locator('input[type="file"]').setInputFiles({name: 'scroll.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))});
    await page.locator('.toast').filter({hasText: 'Datensicherung erfolgreich importiert.'}).waitFor(); await dismiss();
    await page.locator('nav').getByRole('button', {name: 'Tagebuch', exact: true}).click();
    await opened(() => page.getByRole('button', {name: 'Ziele bearbeiten', exact: true}).click(), '.goal-editor h3');
    await quiet(() => page.getByLabel('Kalorien (kcal)', {exact: true}).fill('2100'));
    await page.getByLabel('Kalorien (kcal)', {exact: true}).fill('2000');
    await quiet(() => page.getByRole('button', {name: 'Tagesziele schließen', exact: true}).click());
    await opened(() => page.getByRole('button', {name: 'Ziele bearbeiten', exact: true}).click(), '.goal-editor h3');
    await page.getByRole('button', {name: 'Tagesziele schließen', exact: true}).click();
    await opened(() => page.getByRole('button', {name: 'Tagesnotiz hinzufügen', exact: true}).click(), '.day-notes__form > .hint');
    await quiet(() => page.getByLabel('Eigene Beobachtungen', {exact: true}).fill('Kein erneutes Scrollen beim Tippen.'));
    await quiet(async () => {await page.getByRole('button', {name: 'Notiz speichern', exact: true}).click(); await page.locator('.toast').filter({hasText: 'Tagesnotiz gespeichert.'}).waitFor(); await dismiss();});
    await quiet(() => page.getByRole('button', {name: 'Tagesnotizen einklappen', exact: true}).click());
    await opened(() => page.getByRole('button', {name: 'Tagesnotizen bearbeiten', exact: true}).click(), '.day-notes__form > .hint');
    await page.getByRole('button', {name: 'Tagesnotizen einklappen', exact: true}).click();
    await opened(() => page.getByRole('button', {name: 'Trinkverlauf aufklappen', exact: true}).click(), '.drink-form h3');
    await quiet(() => page.getByLabel('Getränk', {exact: true}).fill('Tee'));
    await page.getByLabel('Getränk', {exact: true}).fill('Wasser');
    await quiet(() => page.getByRole('button', {name: 'Trinkverlauf einklappen', exact: true}).click());
    await opened(() => page.locator('.weight-tracker__entry').click(), '.weight-entry-form h3');
    assert.equal(await page.locator('.weight-entry-form input').evaluate(el => document.activeElement === el), true);
    await page.getByRole('button', {name: 'Gewichtseingabe schließen', exact: true}).click();
    await opened(() => page.getByRole('button', {name: 'Verlauf anzeigen', exact: true}).click(), '.weight-stats > div:first-child span');
    await opened(() => page.locator('.weight-chart__table > summary').click(), '.weight-chart__table > summary');
    await quiet(() => page.locator('.weight-chart__table > summary').click());
    await quiet(() => page.getByRole('button', {name: 'Verlauf ausblenden', exact: true}).click());
    const entry = page.locator('.entry').last();
    await opened(() => entry.locator('.diary-entry__toggle').click(), '.entry:last-of-type .diary-entry__toggle');
    await quiet(() => entry.locator('.diary-entry__toggle').click());
    await opened(() => page.getByRole('button', {name: 'Frühstück kopieren', exact: true}).click(), '.meal-copy h3');
    await page.getByRole('button', {name: 'Kopieren abbrechen', exact: true}).click();
    await opened(() => page.getByRole('button', {name: 'Frühstück als Vorlage speichern', exact: true}).click(), '.meal-copy h3');
    await page.getByRole('button', {name: 'Vorlage abbrechen', exact: true}).click();
    await opened(() => page.getByRole('button', {name: 'Tagebuchsuche', exact: true}).click(), '.diary-search h3');
    await quiet(() => page.getByLabel('Suchbegriff', {exact: true}).fill('Eigenes'));
    await page.getByRole('button', {name: 'Tagebuchsuche schließen', exact: true}).click();
    await page.getByRole('button', {name: 'Kompakt', exact: true}).click();
    await opened(() => page.getByRole('button', {name: 'Menge für Eigenes Lebensmittel 4 ändern', exact: true}).click(), '.entry:has([aria-label="Menge für Eigenes Lebensmittel 4 ändern"]) .quick-quantity label');
    await page.getByRole('button', {name: 'Menge für Eigenes Lebensmittel 4 ändern', exact: true}).click();
    await opened(() => page.getByRole('button', {name: 'Lebensmittel hinzufügen', exact: true}).click(), '.diary-entry-editor h3');
    await page.locator('.recent-foods > summary').click();
    await opened(() => page.locator('.recent-foods > summary').click(), '.recent-foods > summary');
    await page.getByRole('button', {name: 'Schließen', exact: true}).click();
    await page.locator('nav').getByRole('button', {name: 'Planen', exact: true}).click();
    await page.getByRole('heading', {name: 'Mein Frühstück', exact: true}).waitFor();
    await opened(() => page.getByRole('button', {name: 'Eintragen', exact: true}).click(), '.planning-inline-form h3');
    await page.getByRole('button', {name: 'Vorlage eintragen abbrechen', exact: true}).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width} × ${viewport.height} (${viewport.smooth ? 'smooth' : 'reduced motion'}): goals, daily notes, hydration, weight entry/history/table, entry details/quantity, copy/templates/search/recent; reopened sections reveal; no repeat scroll on edits/save/close; no overflow/errors`);
    await context.close();
  }
} finally {if (browser) await browser.close(); server.kill();}
