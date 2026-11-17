import {announceDataChange, dbPromise, getDataRevision, type Entry} from './db';
import {validEntryNote} from './diary';
import {withEntryAmount} from './entryQuantity';
import {entrySignature} from './entrySignature';

export type EntryEdit = {before: Entry; after: Entry; revision: number};

async function persist(id: string, update: (current: Entry | undefined) => Entry): Promise<{entry: Entry; change?: EntryEdit}> {
  const revision = getDataRevision();
  const tx = (await dbPromise).transaction('entries', 'readwrite');
  try {
    const before: Entry | undefined = await tx.store.get(id);
    if (revision !== getDataRevision()) throw Error('Die Daten wurden inzwischen importiert. Bitte den Eintrag erneut öffnen.');
    const after = update(before);
    if (after.id !== id || !validEntryNote(after.note)) throw Error('Ungültiger Tagebucheintrag');
    await tx.store.put(after);await tx.done;announceDataChange();
    return {entry: after, change: before && entrySignature(before) !== entrySignature(after)
      ? {before: structuredClone(before), after: structuredClone(after), revision} : undefined};
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
