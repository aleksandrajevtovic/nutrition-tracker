import type {Entry} from './db';
import {isPositive, stats, toGrams} from './nutrition';
import {validDirectItem} from './directNutrition';

export function withEntryAmount<T extends Pick<Entry, 'foodSnapshot' | 'grams' | 'amount' | 'unit'>>(entry: T, amount: number): T {
  if (entry.foodSnapshot.directNutrition) {
    if (!validDirectItem(entry) || !isPositive(amount)) throw Error('Bitte eine gültige Menge über 0 eingeben.');
    const factor = amount / entry.foodSnapshot.directNutrition.amount;
    const food = structuredClone(entry.foodSnapshot);
    for (const key of ['kcal','protein','carbs','sugar','fat','fiber'] as const) if (food[key] !== null) food[key] *= factor;
    food.directNutrition!.amount = amount;
    const result = {...entry, amount, grams: entry.grams * factor, foodSnapshot: food};
    if (!validDirectItem(result)) throw Error('Bitte eine gültige Menge über 0 eingeben.');
    return result;
  }
  const unit = entry.unit ?? 'g';
  const grams = toGrams(entry.foodSnapshot, amount, unit);
  if (!isPositive(amount) || !isPositive(grams) || !Object.values(stats(entry.foodSnapshot, grams)).every(Number.isFinite)) {
    throw Error('Bitte eine gültige Menge über 0 eingeben.');
  }
  return {...entry, amount, unit, grams};
}
