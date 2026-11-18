import type {Entry} from './db';
import {withEntryAmount} from './entryQuantity';
import {entrySignature} from './entrySignature';

export type MealCopySelection = {source: Entry; amount: number};

export function mealCopyAmount(entry: Entry, amount: number): Entry {
  const updated = withEntryAmount(entry, amount);
  // Preserve gram-only legacy records when their amount was not changed.
  return amount === (entry.amount ?? entry.grams) ? structuredClone(entry) : updated;
}

export function selectedMealEntries(current: Entry[], selection: MealCopySelection[]): Entry[] {
  if (!selection.length) throw Error('Bitte mindestens ein Lebensmittel zum Kopieren auswählen.');
  if (new Set(selection.map(item => item.source.id)).size !== selection.length) throw Error('Ein Eintrag wurde mehrfach ausgewählt.');
  return selection.map(({source, amount}) => {
    const entry = current.find(entry => entry.id === source.id);
    if (!entry || entrySignature(entry) !== entrySignature(source)) throw Error('Ein ausgewählter Eintrag wurde inzwischen geändert oder gelöscht. Bitte das Kopierformular erneut öffnen.');
    return mealCopyAmount(entry, amount);
  });
}
