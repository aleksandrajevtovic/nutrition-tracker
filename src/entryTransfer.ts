import {announceDataChange, dbPromise, getDataRevision, type Entry} from './db';
import {duplicateMeal} from './diary';
import {validDate} from './weight';
import {entrySignature as signature} from './entrySignature';

export type EntryTransferMode = 'copy' | 'move';
export type TransferEntry = (source: Entry, date: string, meal: string, mode: EntryTransferMode) => Promise<Entry>;
export type EntryTransferResult = {before: Entry;after: Entry;mode: EntryTransferMode;revision: number};

function announce() {
  announceDataChange();
  if(typeof window!=='undefined')window.dispatchEvent(new Event('nutrition-diary-changed'));
}

export async function transferEntry(source: Entry, date: string, meal: string, mode: EntryTransferMode): Promise<EntryTransferResult> {
  if(!validDate(date) || !meal.trim() || !['copy','move'].includes(mode))throw Error('Bitte ein gültiges Zieldatum und eine Mahlzeit wählen.');
  const revision=getDataRevision();
  const tx=(await dbPromise).transaction('entries','readwrite');
  try{
    const current: Entry | undefined=await tx.store.get(source.id);
    if(!current)throw Error('Dieser Eintrag ist nicht mehr vorhanden.');
    if(revision!==getDataRevision() || signature(current)!==signature(source))throw Error('Dieser Eintrag wurde inzwischen geändert. Bitte die Aktion erneut öffnen.');
    if(mode==='move' && current.date===date && current.meal===meal.trim())throw Error('Bitte ein anderes Zieldatum oder eine andere Mahlzeit wählen.');
    const after=mode==='copy' ? duplicateMeal([current],date,meal)[0] : {...structuredClone(current),date,meal:meal.trim()};
    if(mode==='copy')await tx.store.add(after);else await tx.store.put(after);
    await tx.done;announce();
    return {before:structuredClone(current),after,mode,revision};
  }catch(error){await tx.done.catch(()=>{});throw error;}
}

export async function undoEntryTransfer(result: EntryTransferResult): Promise<void> {
  const tx=(await dbPromise).transaction('entries','readwrite');
  try{
    const current: Entry | undefined=await tx.store.get(result.after.id);
    if(result.revision!==getDataRevision())throw Error('Nach einem Datenimport ist diese Wiederherstellung nicht mehr möglich.');
    if(!current || signature(current)!==signature(result.after))throw Error('Es gibt bereits einen neueren Datensatz. Er wurde nicht überschrieben.');
    if(result.mode==='copy')await tx.store.delete(current.id);else await tx.store.put(result.before);
    await tx.done;announce();
  }catch(error){await tx.done.catch(()=>{});throw error;}
}
