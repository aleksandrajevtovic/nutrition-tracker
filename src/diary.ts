import type {Entry} from './db';
import {validDate} from './weight';

export const validEntryNote = (note: unknown): note is string | undefined => note === undefined || typeof note === 'string';

export function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function duplicateMeal(entries: Entry[], date: string, meal: string): Entry[] {
  if (!validDate(date) || !meal.trim()) throw Error('Bitte ein gültiges Zieldatum und eine Mahlzeit wählen.');
  if (!entries.length) throw Error('Diese Mahlzeit enthält keine Einträge mehr.');
  const time = Date.now();
  return [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((entry, index) => ({
    ...structuredClone(entry), id: crypto.randomUUID(), date, meal: meal.trim(),
    createdAt: new Date(time + index).toISOString(),
  }));
}
