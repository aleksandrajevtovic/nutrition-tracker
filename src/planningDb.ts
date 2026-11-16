import {announceDataChange, dbPromise, getDataRevision, type Entry} from './db';
import {emptyShoppingList, itemsFromEntries, itemsToEntries, mergeShopping, shoppingFromMeals, validPlan, validShopping, validTemplate,
  type MealItem, type MealPlan, type MealTemplate, type ShoppingList} from './planning';
import {validDate} from './weight';

function diaryChanged() {
  announceDataChange();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('nutrition-diary-changed'));
}
export async function getPlanningData() {
  const tx = (await dbPromise).transaction(['templates', 'plans', 'shopping'], 'readonly');
  const [templates, plans, shopping] = await Promise.all([tx.objectStore('templates').getAll(), tx.objectStore('plans').getAll(), tx.objectStore('shopping').get('current')]);
  await tx.done;
  return {templates: (templates as MealTemplate[]).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    plans: (plans as MealPlan[]).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    shopping: (shopping ?? emptyShoppingList()) as ShoppingList};
}
export async function createTemplate(date: string, meal: string, name: string): Promise<MealTemplate> {
  const tx = (await dbPromise).transaction(['entries', 'templates'], 'readwrite');
  const entries: Entry[] = await tx.objectStore('entries').index('by-date').getAll(date);
  const items = itemsFromEntries(entries.filter(entry => entry.meal === meal).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  const template = {id: crypto.randomUUID(), name: name.trim(), meal, items, createdAt: new Date().toISOString()};
  if (!validTemplate(template)) throw Error('Bitte einen Namen und eine Mahlzeit mit Einträgen wählen.');
  await tx.objectStore('templates').add(template); await tx.done;
  announceDataChange(); return template;
}
export async function applyTemplate(id: string, date: string, meal: string, factor: number) {
  const tx = (await dbPromise).transaction(['templates', 'entries'], 'readwrite');
  const template: MealTemplate | undefined = await tx.objectStore('templates').get(id);
  if (!template) throw Error('Diese Vorlage ist nicht mehr vorhanden.');
  const entries = itemsToEntries(template.items, date, meal, factor);
  for (const entry of entries) await tx.objectStore('entries').add(entry);
  await tx.done; diaryChanged(); return entries;
}
export async function savePlan(plan: MealPlan) {
  if (!validPlan(plan) || plan.status !== 'planned') throw Error('Ungültige Wochenplanung');
  const tx = (await dbPromise).transaction('plans', 'readwrite');
  const existing: MealPlan | undefined = await tx.store.get(plan.id);
  if (existing?.status === 'logged') throw Error('Diese Planung wurde bereits ins Tagebuch übernommen.');
  await tx.store.put(plan); await tx.done; announceDataChange();
}
export async function reschedulePlan(id: string, sourceDate: string, targetDate: string): Promise<MealPlan> {
  if(!validDate(sourceDate) || !validDate(targetDate))throw Error('Bitte ein gültiges Zieldatum für die Planung wählen.');
  if(sourceDate===targetDate)throw Error('Bitte einen anderen Tag für die Planung wählen.');
  const revision=getDataRevision();
  const tx=(await dbPromise).transaction('plans','readwrite');
  try{
    const current: MealPlan | undefined=await tx.store.get(id);
    if(!current)throw Error('Diese Planung ist nicht mehr vorhanden.');
    if(current.status!=='planned')throw Error('Diese Planung wurde bereits ins Tagebuch übernommen.');
    if(revision!==getDataRevision() || current.date!==sourceDate)throw Error('Diese Planung wurde inzwischen verschoben. Bitte erneut öffnen.');
    const moved={...current,date:targetDate};
    await tx.store.put(moved);await tx.done;announceDataChange();return moved;
  }catch(error){await tx.done.catch(()=>{});throw error;}
}
export async function logPlan(id: string) {
  const tx = (await dbPromise).transaction(['plans', 'entries'], 'readwrite');
  const plan: MealPlan | undefined = await tx.objectStore('plans').get(id);
  if (!plan) throw Error('Diese Planung ist nicht mehr vorhanden.');
  if (plan.status === 'logged') throw Error('Diese Planung wurde bereits ins Tagebuch übernommen.');
  const entries = itemsToEntries(plan.items, plan.date, plan.meal);
  for (const entry of entries) await tx.objectStore('entries').add(entry);
  await tx.objectStore('plans').put({...plan, status: 'logged', entryIds: entries.map(entry => entry.id)});
  await tx.done; diaryChanged(); return entries;
}
export async function removePlanningRecord(store: 'templates' | 'plans', id: string): Promise<MealTemplate | MealPlan | undefined> {
  const tx = (await dbPromise).transaction(store, 'readwrite');
  const value = await tx.store.get(id); await tx.store.delete(id); await tx.done;
  announceDataChange(); return value;
}
export async function restorePlanningRecord(store: 'templates' | 'plans', value: MealTemplate | MealPlan, revision: number) {
  const tx = (await dbPromise).transaction(store, 'readwrite');
  const existing = await tx.store.get(value.id);
  if (revision !== getDataRevision() || existing) {
    await tx.done; throw Error('Die Wiederherstellung ist nach zwischenzeitlichen Änderungen nicht mehr möglich.');
  }
  await tx.store.add(value); await tx.done; announceDataChange();
}
export async function setShoppingFromMeals(items: MealItem[], append: boolean) {
  const additions = shoppingFromMeals(items);
  const tx = (await dbPromise).transaction('shopping', 'readwrite');
  const previous: ShoppingList = (await tx.store.get('current')) ?? emptyShoppingList();
  const shopping = {items: append ? mergeShopping(previous.items, additions) : additions, updatedAt: new Date().toISOString()};
  await tx.store.put(shopping, 'current'); await tx.done; announceDataChange();
}
export async function shoppingFromPlanWeek(start: string, end: string, append: boolean) {
  if (!validDate(start) || !validDate(end) || start > end) throw Error('Ungültige Wochenplanung');
  const tx = (await dbPromise).transaction(['plans', 'shopping'], 'readwrite');
  const plans: MealPlan[] = await tx.objectStore('plans').index('by-date').getAll(IDBKeyRange.bound(start, end));
  const additions = shoppingFromMeals(plans.filter(plan => plan.status === 'planned').flatMap(plan => plan.items));
  const previous: ShoppingList = (await tx.objectStore('shopping').get('current')) ?? emptyShoppingList();
  await tx.objectStore('shopping').put({items: append ? mergeShopping(previous.items, additions) : additions, updatedAt: new Date().toISOString()}, 'current');
  await tx.done; announceDataChange();
}
export async function toggleShoppingItem(id: string, checked?: boolean) {
  const tx = (await dbPromise).transaction('shopping', 'readwrite');
  const previous: ShoppingList = (await tx.store.get('current')) ?? emptyShoppingList();
  await tx.store.put({...previous, updatedAt: new Date().toISOString(), items: previous.items.map(item => item.id === id ? {...item, checked: checked ?? !item.checked} : item)}, 'current');
  await tx.done; announceDataChange();
}
export async function clearShopping() {
  const tx = (await dbPromise).transaction('shopping', 'readwrite');
  const previous: ShoppingList = (await tx.store.get('current')) ?? emptyShoppingList();
  const cleared = {...emptyShoppingList(), updatedAt: new Date().toISOString()};
  await tx.store.put(cleared, 'current'); await tx.done; announceDataChange();
  return {previous, clearedAt: cleared.updatedAt};
}
export async function restoreShopping(previous: ShoppingList, clearedAt: string, revision: number) {
  if (!validShopping(previous)) throw Error('Ungültige Einkaufsmenge');
  const tx = (await dbPromise).transaction('shopping', 'readwrite');
  const current: ShoppingList | undefined = await tx.store.get('current');
  if (revision !== getDataRevision() || current?.updatedAt !== clearedAt || current.items.length) {
    await tx.done; throw Error('Die Wiederherstellung ist nach zwischenzeitlichen Änderungen nicht mehr möglich.');
  }
  await tx.store.put(previous, 'current'); await tx.done; announceDataChange();
}
