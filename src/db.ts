import {openDB} from 'idb';
import {germanEntry, germanFood} from './german';
import {isPositive, toGrams, units, validFood, type Unit} from './nutrition';
import {backupWeights, validDate, validWeight, type WeightRecord} from './weight';
import {duplicateMeal, validEntryNote} from './diary';
import {backupGoals, validGoals, type DailyGoals} from './goals';
import {validRecipeFood, type Recipe} from './recipes';
import {validExportTime} from './backup';
import {backupWorkspace, emptyShoppingList, type WorkspaceBackup} from './planning';
import {backupNotes, validNote, type DailyNote} from './notes';
import {withEntryAmount} from './entryQuantity';
import {backupDrinks, validDrink, type Drink} from './hydration';
import {barcodeKey} from './barcode';
import {backupCompletedDays} from './completedDays';

export type Food = {
  id: string;
  name: string;
  brand: string;
  barcode?: string;
  source?: {type: 'openfoodfacts'; importedAt: string};
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  // null means not declared; numeric zero is an explicitly known zero.
  fiber: number | null;
  sugar: number;
  portionName: string;
  portionGrams: number;
  portions?: {name: string; grams: number}[];
  nutritionReference?: {unit: 'g' | 'ml' | 'portion'; amount: number};
  gramsPerMl?: number;
  pieceGrams?: number;
  sliceGrams?: number;
  favorite?: boolean;
  recipe?: Recipe;
  createdAt: string;
};

export type Entry = {
  id: string;
  foodId: string;
  date: string;
  meal: string;
  grams: number;
  // Optional so existing gram-only diary entries and backups remain compatible.
  amount?: number;
  unit?: Unit;
  note?: string;
  foodSnapshot: Food;
  createdAt: string;
};

export type Backup = {version: 6; exportedAt: string; foods: Food[]; entries: Entry[]; weights: WeightRecord[]; goals: DailyGoals; dailyNotes: DailyNote[]; drinks: Drink[]; completedDays?: string[]} & WorkspaceBackup;
type LegacyBackup = {version: 1 | 2 | 3 | 4 | 5; exportedAt: string; foods: Food[]; entries: Entry[]; weights?: WeightRecord[]; goals?: DailyGoals; dailyNotes?: DailyNote[]};
let dataRevision = 0;
export const getDataRevision = () => dataRevision;
export function announceDataChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('nutrition-data-changed'));
}

export const dbPromise = openDB('nutrition-tracker', 7, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      db.createObjectStore('foods', {keyPath: 'id'});
      const entries = db.createObjectStore('entries', {keyPath: 'id'});
      entries.createIndex('by-date', 'date');
    }
    if (oldVersion < 3) db.createObjectStore('weights', {keyPath: 'date'});
    if (oldVersion < 4) db.createObjectStore('settings');
    if (oldVersion < 5) {
      db.createObjectStore('templates', {keyPath: 'id'});
      db.createObjectStore('plans', {keyPath: 'id'}).createIndex('by-date', 'date');
      db.createObjectStore('shopping');
    }
    if (oldVersion < 6) db.createObjectStore('notes', {keyPath: 'date'});
    if (oldVersion < 7) db.createObjectStore('drinks', {keyPath: 'id'}).createIndex('by-date', 'date');
    // Translate existing labels and snapshots without changing quantities or nutrients.
    if (oldVersion < 2) {
      const translateFoods = async () => {
        let cursor = await transaction.objectStore('foods').openCursor();
        while (cursor) {await cursor.update(germanFood(cursor.value)); cursor = await cursor.continue();}
      };
      const translateEntries = async () => {
        let cursor = await transaction.objectStore('entries').openCursor();
        while (cursor) {await cursor.update(germanEntry(cursor.value)); cursor = await cursor.continue();}
      };
      void Promise.all([translateFoods(), translateEntries()]).catch(() => transaction.abort());
    }
  },
});

export async function listFoods(): Promise<Food[]> {
  return (await (await dbPromise).getAll('foods')).sort((a: Food, b: Food) => a.name.localeCompare(b.name));
}
export async function saveFood(food: Food) {
  if (!validFood(food)) throw Error('Ungültige Produktdaten');
  if (food.recipe !== undefined && !validRecipeFood(food)) throw Error('Ungültige Rezeptdaten');
  const tx = (await dbPromise).transaction('foods', 'readwrite');
  if (food.barcode) {
    const foods: Food[] = await tx.store.getAll();
    if (foods.some(other => other.id !== food.id && other.barcode && barcodeKey(other.barcode) === barcodeKey(food.barcode!))) {
      await tx.done;
      throw Error('Dieser Barcode gehört bereits zu einem gespeicherten Lebensmittel. Bitte das vorhandene Produkt bearbeiten.');
    }
  }
  await tx.store.put(food); await tx.done;
}
export async function removeFood(id: string): Promise<Food | undefined> {
  return deleteRecord('foods', id);
}
export async function toggleFoodFavorite(id: string): Promise<Food> {
  const tx = (await dbPromise).transaction('foods', 'readwrite');
  const food: Food | undefined = await tx.store.get(id);
  if (!food) throw Error('Dieses Lebensmittel ist nicht mehr vorhanden.');
  const updated = {...food, favorite: !food.favorite};
  await tx.store.put(updated);
  await tx.done;
  return updated;
}
export async function listEntries(date: string): Promise<Entry[]> {
  return (await (await dbPromise).getAllFromIndex('entries', 'by-date', date))
    .sort((a: Entry, b: Entry) => a.createdAt.localeCompare(b.createdAt));
}
export async function listDiaryHistory(): Promise<Entry[]> {
  return (await dbPromise).getAll('entries');
}
export async function saveEntry(entry: Entry) {
  if (!validEntryNote(entry.note)) throw Error('Ungültige Eintragsnotiz');
  await (await dbPromise).put('entries', entry);
  announceDataChange();
}
export async function changeEntryAmount(id: string, amount: number): Promise<Entry> {
  const tx = (await dbPromise).transaction('entries', 'readwrite');
  const current: Entry | undefined = await tx.store.get(id);
  if (!current) throw Error('Dieser Eintrag ist nicht mehr vorhanden.');
  const updated = withEntryAmount(current, amount);
  await tx.store.put(updated);
  await tx.done;
  announceDataChange();
  return updated;
}
export async function copyMealEntries(sourceDate: string, sourceMeal: string, targetDate: string, targetMeal: string): Promise<Entry[]> {
  const db = await dbPromise;
  const tx = db.transaction('entries', 'readwrite');
  const source: Entry[] = await tx.store.index('by-date').getAll(sourceDate);
  const copies = duplicateMeal(source.filter(entry => entry.meal === sourceMeal), targetDate, targetMeal);
  for (const entry of copies) await tx.store.add(entry);
  await tx.done;
  announceDataChange();
  return copies;
}
export async function removeEntry(id: string): Promise<Entry | undefined> {
  return deleteRecord('entries', id);
}
export async function listWeights(): Promise<WeightRecord[]> {
  return (await (await dbPromise).getAll('weights')).sort((a: WeightRecord, b: WeightRecord) => a.date.localeCompare(b.date));
}
export async function saveWeight(record: WeightRecord) {
  if (!validWeight(record)) throw Error('Ungültige Gewichtsdaten');
  await (await dbPromise).put('weights', record);
  announceDataChange();
}
export async function removeWeight(date: string): Promise<WeightRecord | undefined> {
  return deleteRecord('weights', date);
}

async function deleteRecord(store: 'foods' | 'entries' | 'weights', key: string) {
  const tx = (await dbPromise).transaction(store, 'readwrite');
  const record = await tx.store.get(key);
  await tx.store.delete(key);
  await tx.done;
  announceDataChange();
  return record;
}

async function restoreDeletedRecord(store: 'foods' | 'entries' | 'weights', key: string, record: Food | Entry | WeightRecord, revision: number) {
  const tx = (await dbPromise).transaction(store, 'readwrite');
  const existing = await tx.store.get(key);
  if (revision !== dataRevision || existing !== undefined) {
    await tx.done;
    throw Error(revision !== dataRevision ? 'Nach einem Datenimport ist diese Wiederherstellung nicht mehr möglich.' : 'Es gibt bereits einen neueren Datensatz. Er wurde nicht überschrieben.');
  }
  if (store === 'foods' && (record as Food).barcode) {
    const foods: Food[] = await tx.store.getAll();
    if (foods.some(food => food.barcode && barcodeKey(food.barcode) === barcodeKey((record as Food).barcode!))) {
      await tx.done;throw Error('Dieser Barcode gehört bereits zu einem gespeicherten Lebensmittel. Bitte das vorhandene Produkt bearbeiten.');
    }
  }
  await tx.store.add(record);
  await tx.done;
  announceDataChange();
}
export const restoreDeletedEntry = (entry: Entry, revision: number) => restoreDeletedRecord('entries', entry.id, entry, revision);
export const restoreDeletedFood = (food: Food, revision: number) => restoreDeletedRecord('foods', food.id, food, revision);
export const restoreDeletedWeight = (record: WeightRecord, revision: number) => restoreDeletedRecord('weights', record.date, record, revision);
export async function getDailyGoals(): Promise<DailyGoals> {
  return (await (await dbPromise).get('settings', 'dailyGoals')) ?? {};
}
export async function saveDailyGoals(goals: DailyGoals) {
  if (!validGoals(goals)) throw Error('Ungültige Tagesziele');
  await (await dbPromise).put('settings', goals, 'dailyGoals');
  announceDataChange();
}
export async function getCompletedDays(): Promise<string[]> {
  return (await (await dbPromise).get('settings', 'completedDays')) ?? [];
}
export async function setDayCompleted(date: string, completed: boolean) {
  if (!validDate(date) || typeof completed !== 'boolean') throw Error('Ungültiger Tagesstatus');
  const tx = (await dbPromise).transaction('settings', 'readwrite');
  const dates: string[] = (await tx.store.get('completedDays')) ?? [];
  const next = dates.filter(value => value !== date);
  if (completed) next.push(date);
  await tx.store.put(next.sort(), 'completedDays');
  await tx.done;
  announceDataChange();
}
export async function getPeriodData(start: string, end: string): Promise<{entries: Entry[]; weights: WeightRecord[]; goals: DailyGoals; drinks: Drink[]; dailyNotes: DailyNote[]; completedDays: string[]}> {
  if (!validDate(start) || !validDate(end) || start > end) throw Error('Bitte ein gültiges Datum für die Wochenübersicht wählen.');
  const tx = (await dbPromise).transaction(['entries', 'weights', 'settings', 'drinks', 'notes'], 'readonly');
  const range = IDBKeyRange.bound(start, end);
  const [entries, weights, goals, drinks, dailyNotes, completedDays] = await Promise.all([
    tx.objectStore('entries').index('by-date').getAll(range),
    tx.objectStore('weights').getAll(range),
    tx.objectStore('settings').get('dailyGoals'),
    tx.objectStore('drinks').index('by-date').getAll(range),
    tx.objectStore('notes').getAll(range),
    tx.objectStore('settings').get('completedDays'),
  ]);
  await tx.done;
  return {entries, weights, goals: goals ?? {}, drinks, dailyNotes, completedDays: (completedDays ?? []).filter((date: string) => date >= start && date <= end)};
}
export async function getBackup(): Promise<Backup> {
  const tx = (await dbPromise).transaction(['foods', 'entries', 'weights', 'settings', 'templates', 'plans', 'shopping', 'notes', 'drinks'], 'readonly');
  const [foods, entries, weights, goals, templates, plans, shoppingList, dailyNotes, drinks, completedDays] = await Promise.all([
    tx.objectStore('foods').getAll(), tx.objectStore('entries').getAll(), tx.objectStore('weights').getAll(),
    tx.objectStore('settings').get('dailyGoals'), tx.objectStore('templates').getAll(), tx.objectStore('plans').getAll(),
    tx.objectStore('shopping').get('current'), tx.objectStore('notes').getAll(), tx.objectStore('drinks').getAll(),
    tx.objectStore('settings').get('completedDays'),
  ]);
  await tx.done;
  return {
    version: 6, exportedAt: new Date().toISOString(),
    foods, entries, weights, goals: goals ?? {}, templates, plans, shoppingList: shoppingList ?? emptyShoppingList(), dailyNotes, drinks, completedDays: completedDays ?? [],
  };
}

// This records a download on this browser, so it deliberately stays outside exported/imported backups.
export async function getLastBackupExport(): Promise<string | null> {
  const value: unknown = await (await dbPromise).get('settings', 'lastBackupExport');
  if (value === undefined) return null;
  if (!validExportTime(value)) throw Error('Ungültiger Exportzeitpunkt');
  return value;
}
export async function recordBackupExport(value = new Date().toISOString()): Promise<string> {
  if (!validExportTime(value)) throw Error('Ungültiger Exportzeitpunkt');
  await (await dbPromise).put('settings', value, 'lastBackupExport');
  return value;
}

function isFood(food: Food): boolean {
  return Boolean(food && typeof food.id === 'string' && typeof food.name === 'string'
    && typeof food.brand === 'string' && typeof food.portionName === 'string'
    && typeof food.createdAt === 'string' && validFood(food)
    && (food.recipe === undefined || validRecipeFood(food)));
}

export async function restoreBackup(data: unknown) {
  if (!data || typeof data !== 'object') throw Error('Ungültige Datei');
  const backup = data as Partial<Backup | LegacyBackup>;
  if (![1, 2, 3, 4, 5, 6].includes(backup.version!) || !Array.isArray(backup.foods) || !Array.isArray(backup.entries)) {
    throw Error('Nicht unterstütztes Sicherungsformat');
  }
  const weights = backupWeights(backup);
  const goals = backupGoals(backup);
  const workspace = backupWorkspace(backup);
  const dailyNotes = backupNotes(backup);
  const drinks = backupDrinks(backup as {version?: unknown; drinks?: unknown});
  const completedDays = backupCompletedDays(backup as {completedDays?: unknown});
  const barcodes = new Set<string>();
  for (const food of backup.foods) {
    if (!isFood(food)) throw Error('Ungültige Produktdaten');
    if (food.barcode) {
      const key = barcodeKey(food.barcode);
      if (barcodes.has(key)) throw Error('Dieser Barcode gehört bereits zu einem gespeicherten Lebensmittel. Bitte das vorhandene Produkt bearbeiten.');
      barcodes.add(key);
    }
  }
  for (const entry of backup.entries) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.foodId !== 'string'
      || typeof entry.meal !== 'string' || typeof entry.createdAt !== 'string'
      || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      || !Number.isFinite(entry.grams) || entry.grams < 0 || !isFood(entry.foodSnapshot) || !validEntryNote(entry.note)) {
      throw Error('Ungültige Tagebucheinträge');
    }
    if (entry.unit !== undefined || entry.amount !== undefined) {
      if (!units.includes(entry.unit as Unit) || !isPositive(entry.amount)) throw Error('Ungültige Mengeneinheit');
      const converted = toGrams(entry.foodSnapshot, entry.amount, entry.unit!);
      if (!isPositive(converted) || Math.abs(converted - entry.grams) > Math.max(1e-8, entry.grams * 1e-9)) {
        throw Error('Ungültige Mengenangabe');
      }
    }
  }
  // Validate everything before replacing local data, then restore all stores atomically.
  const db = await dbPromise;
  const tx = db.transaction(['foods', 'entries', 'weights', 'settings', 'templates', 'plans', 'shopping', 'notes', 'drinks'], 'readwrite');
  await tx.objectStore('foods').clear();
  await tx.objectStore('entries').clear();
  for (const food of backup.foods) await tx.objectStore('foods').put(germanFood(food));
  for (const entry of backup.entries) await tx.objectStore('entries').put(germanEntry(entry));
  if (weights !== undefined) {
    await tx.objectStore('weights').clear();
    for (const record of weights) await tx.objectStore('weights').put(record);
  }
  if (goals !== undefined) await tx.objectStore('settings').put(goals, 'dailyGoals');
  if (completedDays !== undefined) await tx.objectStore('settings').put([...completedDays].sort(), 'completedDays');
  if (workspace) {
    await tx.objectStore('templates').clear(); await tx.objectStore('plans').clear();
    for (const template of workspace.templates) await tx.objectStore('templates').put(template);
    for (const plan of workspace.plans) await tx.objectStore('plans').put(plan);
    await tx.objectStore('shopping').put(workspace.shoppingList, 'current');
  }
  if (dailyNotes !== undefined) {
    await tx.objectStore('notes').clear();
    for (const note of dailyNotes) await tx.objectStore('notes').put(note);
  }
  if (drinks !== undefined) {
    await tx.objectStore('drinks').clear();
    for (const drink of drinks) await tx.objectStore('drinks').put(drink);
  }
  await tx.done;
  dataRevision++;
  announceDataChange();
}

export async function getDayNote(date: string): Promise<DailyNote | undefined> {
  if (!validDate(date)) throw Error('Ungültige Tagesnotiz');
  return (await dbPromise).get('notes', date);
}

export async function listDrinks(date: string): Promise<Drink[]> {
  if (!validDate(date)) throw Error('Ungültige Trinkdaten');
  return (await dbPromise).getAllFromIndex('drinks', 'by-date', date);
}
export async function saveDrink(drink: Drink) {
  if (!validDrink(drink)) throw Error('Ungültige Trinkdaten');
  await (await dbPromise).put('drinks', drink); announceDataChange();
}
export async function removeDrink(id: string): Promise<Drink | undefined> {
  const tx = (await dbPromise).transaction('drinks', 'readwrite');
  const drink = await tx.store.get(id); await tx.store.delete(id); await tx.done;
  announceDataChange(); return drink;
}
export async function restoreDeletedDrink(drink: Drink, revision: number) {
  if (!validDrink(drink)) throw Error('Ungültige Trinkdaten');
  const tx = (await dbPromise).transaction('drinks', 'readwrite');
  const current = await tx.store.get(drink.id);
  if (revision !== dataRevision || current) {
    await tx.done; throw Error('Die Wiederherstellung ist nach zwischenzeitlichen Änderungen nicht mehr möglich.');
  }
  await tx.store.add(drink); await tx.done; announceDataChange();
}
function announceNotesChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('nutrition-notes-changed'));
}
export async function saveDayNote(note: DailyNote) {
  if (!validNote(note)) throw Error('Ungültige Tagesnotiz');
  await (await dbPromise).put('notes', note); announceNotesChange();
}
export async function removeDayNote(date: string): Promise<DailyNote | undefined> {
  if (!validDate(date)) throw Error('Ungültige Tagesnotiz');
  const tx = (await dbPromise).transaction('notes', 'readwrite');
  const note = await tx.store.get(date); await tx.store.delete(date); await tx.done;
  announceNotesChange(); return note;
}
export async function restoreDeletedDayNote(note: DailyNote, revision: number) {
  const tx = (await dbPromise).transaction('notes', 'readwrite');
  const current = await tx.store.get(note.date);
  if (revision !== dataRevision || current) {
    await tx.done; throw Error('Die Wiederherstellung ist nach zwischenzeitlichen Änderungen nicht mehr möglich.');
  }
  await tx.store.add(note); await tx.done; announceNotesChange();
}
