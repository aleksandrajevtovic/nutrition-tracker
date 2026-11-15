import type {Entry} from './db';
import {isPositive, stats, toGrams} from './nutrition';

export function withEntryAmount(entry: Entry, amount: number): Entry {
  const unit = entry.unit ?? 'g';
  const grams = toGrams(entry.foodSnapshot, amount, unit);
  if (!isPositive(amount) || !isPositive(grams) || !Object.values(stats(entry.foodSnapshot, grams)).every(Number.isFinite)) {
    throw Error('Bitte eine gültige Menge über 0 eingeben.');
  }
  return {...entry, amount, unit, grams};
}
