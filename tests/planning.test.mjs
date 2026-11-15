import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {openDB} from 'idb';
import {loadTypeScript} from './helpers/typescript.mjs';

const domain = await loadTypeScript(new URL('../src/planning.ts', import.meta.url));
const {buildRecipeFood, makeIngredient} = await loadTypeScript(new URL('../src/recipes.ts', import.meta.url));
const banana = {id: 'banana', name: 'Banane', brand: '', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3,
  fiber: 2.6, sugar: 12.2, portionName: '1 Banane', portionGrams: 100, createdAt: '2026-11-15T00:00:00.000Z'};
const milk = {...banana, id: 'milk', name: 'Milch', brand: 'Bio', kcal: 60, protein: 3, portionName: '1 Glas', portionGrams: 200, gramsPerMl: 1};
const entries = [
  {id: 'a', foodId: banana.id, date: '2026-11-15', meal: 'Frühstück', grams: 100, amount: 1, unit: 'portion', foodSnapshot: banana, createdAt: banana.createdAt},
  {id: 'b', foodId: milk.id, date: '2026-11-15', meal: 'Frühstück', grams: 200, amount: 200, unit: 'ml', foodSnapshot: milk, createdAt: '2026-11-15T00:01:00.000Z'},
];
const recipe = buildRecipeFood({...banana, id: 'smoothie', name: 'Smoothie'}, {servings: 2, yieldGrams: 400, instructions: '', ingredients: [makeIngredient(banana, 200, 'g'), makeIngredient(milk, 300, 'ml')]});
const old = await openDB('nutrition-tracker', 4, {upgrade(db) {
  db.createObjectStore('foods', {keyPath: 'id'});
  db.createObjectStore('entries', {keyPath: 'id'}).createIndex('by-date', 'date');
  db.createObjectStore('weights', {keyPath: 'date'});
  db.createObjectStore('settings');
}});
for (const entry of entries) await old.put('entries', entry);
await old.put('settings', '2026-11-15T08:00:00.000Z', 'lastBackupExport');
old.close();
const db = await loadTypeScript(new URL('../src/db.ts', import.meta.url));
const planning = await loadTypeScript(new URL('../src/planningDb.ts', import.meta.url));

test('meal factors preserve units and snapshots and reject invalid amounts', () => {
  const items = domain.itemsFromEntries(entries);
  const scaled = domain.scaleItems(items, 0.5);
  assert.deepEqual(scaled.map(item => [item.grams, item.amount, item.unit]), [[50, 0.5, 'portion'], [100, 100, 'ml']]);
  assert.equal(items[0].grams, 100);
  for (const factor of [0, -1, NaN, Infinity]) assert.throws(() => domain.scaleItems(items, factor));
  const first = domain.itemsToEntries(items, '2026-11-16', 'Mittagessen');
  const second = domain.itemsToEntries(items, '2026-11-16', 'Mittagessen');
  assert.notEqual(first[0].id, second[0].id);
  assert.equal(first[0].foodSnapshot.kcal, 89);
  assert.throws(() => domain.itemsToEntries(items, '2026-02-30', 'Mittagessen'));
});

test('recipe shopping uses raw ingredient quantities rather than cooked weight, and merges shared foods', () => {
  const list = domain.shoppingFromMeals([domain.itemFromFood(recipe, 1, 'portion'), domain.itemFromFood(recipe, 0.5, 'portion'), domain.itemFromFood(banana, 50, 'g')]);
  assert.equal(list.find(item => item.foodId === banana.id).grams, 200);
  assert.equal(list.find(item => item.foodId === milk.id).grams, 225);
  const merged = domain.mergeShopping(list.map(item => ({...item, checked: true})), [list[0]]);
  assert.equal(merged[0].checked, false);
  assert.equal(merged[1].checked, true);
  assert.throws(() => domain.shoppingFromMeals([]));
});

test('workspace validation rejects malformed items and duplicate IDs', () => {
  const template = {id: 't', name: 'Frühstück', meal: 'Frühstück', createdAt: banana.createdAt, items: domain.itemsFromEntries(entries)};
  assert.equal(domain.validTemplate(template), true);
  assert.equal(domain.validMealItem({...template.items[0], grams: 999}), false);
  assert.throws(() => domain.backupWorkspace({version: 4, templates: [template, template], plans: [], shoppingList: domain.emptyShoppingList()}));
  assert.equal(domain.backupWorkspace({version: 3}), undefined);
});

test('persistent templates, shopping and weekly plans preserve data and avoid duplicate diary entries', async t => {
  let template;
  let plan;
  await t.test('migration retains the diary and device-specific export history', async () => {
    assert.deepEqual(await db.listEntries('2026-11-15'), entries);
    assert.equal(await db.getLastBackupExport(), '2026-11-15T08:00:00.000Z');
    assert.deepEqual((await planning.getPlanningData()).templates, []);
  });
  await t.test('saving and applying a meal template preserves nutrition independently from the food library', async () => {
    template = await planning.createTemplate('2026-11-15', 'Frühstück', 'Mein Frühstück');
    await db.saveFood({...banana, kcal: 999});
    await db.removeFood(banana.id);
    const copies = await planning.applyTemplate(template.id, '2026-11-16', 'Mittagessen', 0.5);
    assert.deepEqual(copies.map(item => item.grams), [50, 100]);
    assert.equal(copies[0].foodSnapshot.kcal, 89);
    assert.equal((await db.listEntries('2026-11-15')).length, 2);
    await assert.rejects(planning.createTemplate('2026-11-10', 'Frühstück', 'Leer'));
  });
  await t.test('planned meals do not enter the diary until explicitly logged', async () => {
    plan = {id: 'plan', name: 'Geplantes Frühstück', date: '2026-11-17', meal: 'Frühstück', items: domain.scaleItems(template.items, 2), status: 'planned', entryIds: [], createdAt: banana.createdAt};
    await planning.savePlan(plan);
    assert.deepEqual(await db.listEntries(plan.date), []);
    const results = await Promise.allSettled([planning.logPlan(plan.id), planning.logPlan(plan.id)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.listEntries(plan.date)).length, 2);
    const saved = (await planning.getPlanningData()).plans[0];
    assert.equal(saved.status, 'logged');
    assert.equal(saved.entryIds.length, 2);
    await assert.rejects(planning.savePlan({...plan, name: 'Überschreiben'}), /bereits/);
  });
  await t.test('recipe shopping and checkmarks persist, and increases reset only affected checks', async () => {
    await planning.setShoppingFromMeals([domain.itemFromFood(recipe, 1, 'portion')], false);
    await planning.toggleShoppingItem(banana.id);
    assert.equal((await planning.getPlanningData()).shopping.items[0].checked, true);
    await Promise.all([planning.toggleShoppingItem(banana.id, true), planning.toggleShoppingItem(banana.id, true)]);
    assert.equal((await planning.getPlanningData()).shopping.items[0].checked, true);
    await planning.setShoppingFromMeals([domain.itemFromFood(banana, 50, 'g')], true);
    const list = (await planning.getPlanningData()).shopping;
    assert.equal(list.items[0].grams, 150);
    assert.equal(list.items[0].checked, false);
  });
  await t.test('week-derived shopping excludes logged plans and other weeks', async () => {
    await planning.savePlan({...plan, id: 'open-plan', name: 'Smoothie', items: [domain.itemFromFood(recipe, 0.5, 'portion')]});
    await planning.savePlan({...plan, id: 'other-week', date: '2026-12-01'});
    await planning.shoppingFromPlanWeek('2026-11-16', '2026-11-22', false);
    const list = (await planning.getPlanningData()).shopping.items;
    assert.equal(list[0].grams, 50);
    assert.equal(list[1].grams, 75);
  });
  await t.test('shopping clear can be undone without overwriting later changes', async () => {
    const revision = db.getDataRevision();
    const {previous, clearedAt} = await planning.clearShopping();
    assert.equal((await planning.getPlanningData()).shopping.items.length, 0);
    await planning.restoreShopping(previous, clearedAt, revision);
    assert.deepEqual((await planning.getPlanningData()).shopping, previous);
    await assert.rejects(planning.restoreShopping(previous, clearedAt, revision), /Änderungen/);
  });
  await t.test('a concurrent diary transfer and backup export produce one consistent snapshot', async () => {
    const concurrent = {...plan, id: 'race-plan', date: '2026-11-18'};
    await planning.savePlan(concurrent);
    const [backup] = await Promise.all([db.getBackup(), planning.logPlan(concurrent.id)]);
    const saved = backup.plans.find(value => value.id === concurrent.id);
    const ids = new Set(backup.entries.map(value => value.id));
    if (saved.status === 'logged') assert.ok(saved.entryIds.every(id => ids.has(id)));
    else assert.equal(backup.entries.filter(value => value.date === concurrent.date).length, 0);
    await planning.removePlanningRecord('plans', concurrent.id);
  });
  await t.test('removing a template does not remove plans or diary entries, and supports undo', async () => {
    const revision = db.getDataRevision();
    const deleted = await planning.removePlanningRecord('templates', template.id);
    assert.equal((await planning.getPlanningData()).templates.length, 0);
    await planning.restorePlanningRecord('templates', deleted, revision);
    assert.equal((await planning.getPlanningData()).templates.length, 1);
    assert.equal((await db.listEntries(plan.date)).length, 2);
  });
  await t.test('current backups restore all planning data and legacy backups preserve it', async () => {
    const backup = await db.getBackup();
    assert.equal(backup.version, 6);
    await planning.clearShopping();
    await planning.removePlanningRecord('templates', template.id);
    await db.restoreBackup(JSON.parse(JSON.stringify(backup)));
    assert.deepEqual((await planning.getPlanningData()).shopping, backup.shoppingList);
    assert.equal((await planning.getPlanningData()).templates.length, 1);
    await db.restoreBackup({version: 3, foods: backup.foods, entries: backup.entries, weights: backup.weights, goals: backup.goals});
    assert.equal((await planning.getPlanningData()).plans.length, 3);
    const bad = {...backup, templates: [{...backup.templates[0], items: [{...backup.templates[0].items[0], grams: -1}]}]};
    await assert.rejects(db.restoreBackup(bad), /Planungsdaten/);
    assert.equal((await planning.getPlanningData()).templates.length, 1);
  });
});
