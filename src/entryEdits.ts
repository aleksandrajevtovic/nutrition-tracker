import {announceDataChange, dbPromise, getDataRevision, type Entry} from './db';
import {validEntryNote} from './diary';
import {withEntryAmount} from './entryQuantity';
import {entrySignature} from './entrySignature';
import {validDirectItem} from './directNutrition';
import {validFood} from './nutrition';

export type EntryEdit = {before: Entry; after: Entry; revision: number};
export type EntryAddition = {entry: Entry; revision: number};

async function persist(id: string, update: (current: Entry | undefined) => Entry): Promise<{entry: Entry; change?: EntryEdit; addition?: EntryAddition}> {
  const revision = getDataRevision();
  const tx = (await dbPromise).transaction('entries', 'readwrite');
  try {
    const before: Entry | undefined = await tx.store.get(id);
    if (revision !== getDataRevision()) throw Error('Die Daten wurden inzwischen importiert. Bitte den Eintrag erneut öffnen.');
    const after = update(before);
    if (after.id !== id || !validEntryNote(after.note)) throw Error('Ungültiger Tagebucheintrag');
    if (after.foodSnapshot.directNutrition && !validDirectItem(after)) throw Error('Ungültige Tagebucheinträge');
    if (after.foodSnapshot.entryFiber !== undefined && !validFood(after.foodSnapshot)) throw Error('Ungültige Tagebucheinträge');
    await tx.store.put(after);await tx.done;announceDataChange();
    return {entry: after, change: before && entrySignature(before) !== entrySignature(after)
      ? {before: structuredClone(before), after: structuredClone(after), revision} : undefined,
      addition: before ? undefined : {entry: structuredClone(after), revision}};
  } catch (error) {await tx.done.catch(() => {});throw error;}
}

export const saveEntryWithUndo = (entry: Entry) => persist(entry.id, () => structuredClone(entry));
export const changeEntryAmountWithUndo = (id: string, amount: number) => persist(id, current => {
  if (!current) throw Error('Dieser Eintrag ist nicht mehr vorhanden.');
  return withEntryAmount(current, amount);
});

export function requestEntryEditUndo(entry: Pick<Entry, 'id' | 'date' | 'meal'>): boolean {
  return window.dispatchEvent(new CustomEvent('nutrition-entry-edit-undo-request', {detail: entry, cancelable: true}));
}

export function requestEntryAdditionUndo(entry: Pick<Entry, 'id' | 'date' | 'meal'>): boolean {
  return window.dispatchEvent(new CustomEvent('nutrition-entry-add-undo-request', {detail: entry, cancelable: true}));
}

export async function undoEntryAddition(addition: EntryAddition): Promise<void> {
  const tx = (await dbPromise).transaction('entries', 'readwrite');
  try {
    const current: Entry | undefined = await tx.store.get(addition.entry.id);
    if (addition.revision !== getDataRevision()) throw Error('Nach einem Datenimport ist diese Wiederherstellung nicht mehr möglich.');
    if (!current || entrySignature(current) !== entrySignature(addition.entry)) throw Error('Es gibt bereits einen neueren Datensatz. Er wurde nicht überschrieben.');
    await tx.store.delete(addition.entry.id);await tx.done;
    announceDataChange();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nutrition-diary-changed'));
      window.dispatchEvent(new CustomEvent('nutrition-entry-add-undone', {detail: addition.entry}));
    }
  } catch (error) {await tx.done.catch(() => {});throw error;}
}

export async function undoEntryEdit(change: EntryEdit): Promise<void> {
  const tx = (await dbPromise).transaction('entries', 'readwrite');
  try {
    const current: Entry | undefined = await tx.store.get(change.after.id);
    if (change.revision !== getDataRevision()) throw Error('Nach einem Datenimport ist diese Wiederherstellung nicht mehr möglich.');
    if (!current || entrySignature(current) !== entrySignature(change.after)) throw Error('Es gibt bereits einen neueren Datensatz. Er wurde nicht überschrieben.');
    await tx.store.put(change.before);await tx.done;
    announceDataChange();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nutrition-diary-changed'));
      window.dispatchEvent(new CustomEvent('nutrition-entry-edit-undone', {detail: {id: change.before.id, date: change.before.date, meal: change.before.meal}}));
    }
  } catch (error) {await tx.done.catch(() => {});throw error;}
}
