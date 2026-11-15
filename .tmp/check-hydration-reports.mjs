import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const origin = 'http://127.0.0.1:4185/nutrition-tracker/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4185', '--strictPort'], {windowsHide: true, stdio: 'pipe'});
let browser;
try {
  for (let i = 0; i < 100; i++) {try {if ((await fetch(origin)).ok) break;} catch {} await new Promise(resolve => setTimeout(resolve, 100));}
  browser = await chromium.launch({channel: 'msedge', headless: true});
  await mkdir('.tmp/hydration-reports', {recursive: true});
  for (const viewport of [{width: 320, height: 740}, {width: 375, height: 812}, {width: 768, height: 1024}, {width: 1024, height: 800}, {width: 1440, height: 900}, {width: 568, height: 320}].filter(value => !process.argv[2] || value.width === Number(process.argv[2]))) {
    const context = await browser.newContext({viewport, locale: 'de-DE', reducedMotion: 'reduce'});
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    async function dismiss() {while (await page.getByRole('button', {name: 'Benachrichtigung schließen'}).count()) await page.getByRole('button', {name: 'Benachrichtigung schließen'}).first().click();}
    async function average(value) {await page.waitForFunction(value => document.querySelector('.weekly-average--drinks > strong')?.textContent === value, value);}
    const tab = name => page.locator('nav').getByRole('button', {name, exact: true});
    async function layout() {
      const result = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('main *, nav')].filter(el => {if (el.closest('.meal-filter__list')) return false; const box = el.getBoundingClientRect(); return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1) && getComputedStyle(el).position !== 'absolute';}).slice(0, 5).map(el => el.className)}));
      assert.ok(result.scroll <= result.width + 1, JSON.stringify(result)); assert.deepEqual(result.overflow, [], JSON.stringify(result));
    }
    const food = {id: 'own', name: 'Eigenes Lebensmittel', brand: '', kcal: 400, protein: 20, carbs: 30, fat: 10, fiber: 2, sugar: 3, portionName: '1 Portion', portionGrams: 100, createdAt: '2026-11-15T00:00:00Z'};
    const drink = (id, date, ml) => ({id, date, ml, name: id === 'wed' ? 'Tee' : 'Wasser', time: '12:00', createdAt: food.createdAt});
    const drinks = [drink('prior-a', '2026-11-02', 500), drink('prior-b', '2026-11-03', 500), drink('mon-a', '2026-11-09', 250), drink('mon-b', '2026-11-09', 500), drink('wed', '2026-11-11', 1250), drink('next', '2026-11-16', 3000)];
    const backup = {version: 6, exportedAt: new Date().toISOString(), foods: [food], entries: [{id: 'entry', foodId: food.id, date: '2026-11-09', meal: 'Frühstück', grams: 100, foodSnapshot: food, createdAt: food.createdAt}], weights: [{date: '2026-11-10', kg: 72.5, updatedAt: food.createdAt}], goals: {}, templates: [], plans: [], shoppingList: {items: [], updatedAt: null}, dailyNotes: [], drinks};
    await page.goto(origin); await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    await tab('Datensicherung').click();
    await page.locator('input[type="file"]').setInputFiles({name: 'trinkwochen.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))});
    await page.locator('.toast').filter({hasText: 'Datensicherung erfolgreich importiert.'}).waitFor(); await dismiss();
    await tab('Wochenübersicht').click();
    await page.getByLabel('Datum in der Woche', {exact: true}).fill('2026-11-15'); await average('1 l');
    assert.match(await page.locator('.weekly-average--drinks').innerText(), /2 l insgesamt · 2 Tage/);
    assert.match(await page.locator('.weekly-average--drinks').innerText(), /\+0,5 l zur Vorwoche/);
    const days = page.locator('.weekly-day');
    assert.equal(await days.count(), 7);
    assert.match(await days.nth(0).innerText(), /Trinkmenge\n0,75 l/);
    assert.match(await days.nth(1).innerText(), /Trinkmenge\n—/);
    assert.match(await days.nth(2).innerText(), /Keine Lebensmittel · 1 Getränk/);
    assert.match(await days.nth(2).innerText(), /Trinkmenge\n1,25 l/);
    await page.getByRole('combobox', {name: 'Tagesvergleich', exact: true}).selectOption('drinks');
    assert.match(await page.locator('.weekly-bar').nth(0).getAttribute('aria-label'), /0,75 l/);
    assert.match(await page.locator('.weekly-bar').nth(2).getAttribute('aria-label'), /1,25 l/);
    assert.match(await page.locator('.weekly-bar').nth(1).getAttribute('aria-label'), /Keine Getränke/);
    assert.equal(await page.locator('.weekly-bars__target').count(), 0);
    await layout(); await page.screenshot({path: `.tmp/hydration-reports/week-${viewport.width}.png`});
    await page.getByRole('button', {name: 'Vorherige Woche', exact: true}).click(); await average('0,5 l');
    await page.getByRole('button', {name: 'Nächste Woche', exact: true}).click(); await average('1 l');
    await page.getByRole('button', {name: 'Nächste Woche', exact: true}).click(); await average('3 l');
    await page.getByRole('button', {name: 'Nächste Woche', exact: true}).click(); await average('—');
    assert.equal(await page.locator('.weekly-bar__fill').count(), 0);
    await page.getByLabel('Datum in der Woche', {exact: true}).fill('2026-11-15'); await average('1 l');
    await page.locator('.weekly-bar').nth(2).click();
    await page.getByRole('heading', {name: 'Mein Ernährungstagebuch'}).waitFor();
    assert.equal(await page.getByLabel('Datum', {exact: true}).inputValue(), '2026-11-11');
    await page.getByRole('button', {name: /^Weitere Tagesdaten/}).click();
    await page.getByRole('button', {name: 'Trinkverlauf aufklappen', exact: true}).click();
    await page.getByRole('button', {name: 'Tee um 12:00 bearbeiten', exact: true}).click();
    await page.getByLabel('Trinkmenge', {exact: true}).fill('500');
    await page.getByRole('button', {name: 'Getränk aktualisieren', exact: true}).click();
    await page.locator('.toast').filter({hasText: 'Getränk aktualisiert.'}).waitFor(); await dismiss();
    await tab('Wochenübersicht').click(); await average('0,625 l');
    assert.match(await page.locator('.weekly-average--drinks').innerText(), /\+0,125 l zur Vorwoche/);
    await page.getByRole('combobox', {name: 'Tagesvergleich', exact: true}).selectOption('drinks');
    await page.locator('.weekly-bar').nth(2).click();
    await page.getByRole('button', {name: /^Weitere Tagesdaten/}).click();
    await page.getByRole('button', {name: 'Trinkverlauf aufklappen', exact: true}).click();
    await page.getByRole('button', {name: 'Tee um 12:00 löschen', exact: true}).click();
    await page.locator('.toast').filter({hasText: 'Getränk gelöscht.'}).waitFor();
    await tab('Wochenübersicht').click(); await average('0,75 l');
    await page.locator('.toast').filter({hasText: 'Getränk gelöscht.'}).getByRole('button', {name: 'Rückgängig', exact: true}).click();
    await average('0,625 l'); await dismiss();
    await tab('Datensicherung').click();
    const jsonPending = page.waitForEvent('download'); await page.getByRole('button', {name: 'JSON-Datensicherung herunterladen', exact: true}).click(); await jsonPending; await dismiss();
    const backupTime = await page.locator('.backup-status time').getAttribute('datetime');
    await page.getByLabel('Von (optional)', {exact: true}).fill('2026-11-09');
    await page.getByLabel('Bis (optional)', {exact: true}).fill('2026-11-15');
    const downloadCsv = async name => {const pending = page.waitForEvent('download'); await page.getByRole('button', {name, exact: true}).click(); const file = await pending; const bytes = await readFile(await file.path()); assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]); await dismiss(); return {file, rows: bytes.toString('utf8').replace(/^\uFEFF/, '').trimEnd().split('\r\n').map(line => line.split(';'))};};
    const daily = await downloadCsv('CSV-Tageswerte herunterladen');
    assert.equal(daily.rows[0][9], 'Trinkmenge (ml)');
    assert.equal(daily.rows.length, 4);
    assert.equal(daily.rows[1][9], '750'); assert.equal(daily.rows[2][9], ''); assert.equal(daily.rows[3][9], '500');
    assert.equal(daily.rows[3][2], '');
    await page.getByLabel('CSV-Auswertung', {exact: true}).selectOption('weeks');
    const weekly = await downloadCsv('CSV-Wochenwerte herunterladen');
    assert.ok(weekly.file.suggestedFilename().includes('wochenwerte'));
    assert.equal(weekly.rows.length, 2);
    assert.equal(weekly.rows[1][5], '400');
    assert.deepEqual(weekly.rows[1].slice(13), ['2', '1250', '625']);
    await page.getByLabel('Von (optional)', {exact: true}).fill('2026-11-11');
    const partial = await downloadCsv('CSV-Wochenwerte herunterladen');
    assert.equal(partial.rows[1][2], '2026-11-11');
    assert.equal(partial.rows[1][5], '');
    assert.deepEqual(partial.rows[1].slice(13), ['1', '500', '500']);
    assert.equal(await page.locator('.backup-status time').getAttribute('datetime'), backupTime);
    await layout(); assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width} × ${viewport.height}: daily/weekly hydration and previous-week comparison; water-only days/missing data; chart navigation; edit/delete/undo updates; daily/weekly/partial-range CSV and backup timestamp; no overflow/errors`);
    await context.close();
  }
} finally {if (browser) await browser.close(); server.kill();}
