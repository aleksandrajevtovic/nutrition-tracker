import type {Food} from './db';
import {validBarcode} from './barcode';

export const meals = ['Vor dem Training', 'Frühstück', 'Mittagessen', 'Abendessen', 'Zwischenmahlzeit', 'Sonstiges'];
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export const fmt = (value: number, digits = 1) => value.toLocaleString('de-DE', {maximumFractionDigits: digits});
export const stats = (food: Food, grams: number) => ({
  kcal: food.kcal * grams / 100, protein: food.protein * grams / 100,
  // Unknown fibre contributes no known amount; callers must show incomplete totals.
  carbs: food.carbs * grams / 100, fat: food.fat * grams / 100, fiber: (food.fiber ?? 0) * grams / 100,
});
export const fiberIncomplete = (items: {foodSnapshot: Food}[]) => items.some(item => item.foodSnapshot.fiber === null);
export const emptyFood = (): Food => ({
  id: crypto.randomUUID(), name: '', brand: '', kcal: 0, protein: 0, carbs: 0,
  fat: 0, fiber: 0, sugar: 0, portionName: '1 Portion', portionGrams: 100,
  createdAt: new Date().toISOString(),
});
export const units = ['g', 'mg', 'kg', 'ml', 'l', 'portion', 'piece', 'slice'] as const;
export type Unit = typeof units[number];
export const unitLabels: Record<Unit, string> = {
  g: 'g', mg: 'mg', kg: 'kg', ml: 'ml', l: 'l', portion: 'Portion', piece: 'Stück', slice: 'Scheibe',
};

// Nutrients and legacy entries use grams. Convert other units at the boundary.
export function gramsPerUnit(food: Food, unit: Unit): number | undefined {
  switch (unit) {
    case 'g': return 1;
    case 'mg': return 0.001;
    case 'kg': return 1000;
    case 'ml': return food.gramsPerMl;
    case 'l': return food.gramsPerMl === undefined ? undefined : food.gramsPerMl * 1000;
    case 'portion': return food.portionGrams;
    case 'piece': return food.pieceGrams;
    case 'slice': return food.sliceGrams;
  }
}
export function toGrams(food: Food, amount: number, unit: Unit): number {
  const factor = gramsPerUnit(food, unit);
  return factor !== undefined && factor > 0 ? amount * factor : NaN;
}
export const isPositive = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function validFood(food: Food): boolean {
  return Boolean(food.name.trim() && food.portionName.trim()) && isPositive(food.portionGrams)
    && (food.barcode === undefined || validBarcode(food.barcode))
    && (food.source === undefined || (food.source?.type === 'openfoodfacts' && typeof food.source.importedAt === 'string' && Number.isFinite(Date.parse(food.source.importedAt))))
    && (food.portions === undefined || (Array.isArray(food.portions)
      && food.portions.every(portion => portion && typeof portion.name === 'string' && portion.name.trim() && isPositive(portion.grams)
        && (portion.name.trim() !== food.portionName.trim() || portion.grams === food.portionGrams))
      && new Set(food.portions.map(portion => portion.name.trim())).size === food.portions.length))
    && (food.nutritionReference === undefined || (!!food.nutritionReference && ['g', 'ml', 'portion'].includes(food.nutritionReference.unit)
      && isPositive(food.nutritionReference.amount)
      && (food.nutritionReference.unit !== 'portion' || food.nutritionReference.amount === 1)
      && (food.nutritionReference.unit !== 'ml' || (food.nutritionReference.amount === 100 && isPositive(food.gramsPerMl)))))
    && (food.favorite === undefined || typeof food.favorite === 'boolean')
    && ['kcal','protein','carbs','fat','fiber','sugar'].every(key => {
      const value = food[key as keyof Food];
      if (key === 'fiber' && value === null) return true;
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    })
    && [food.gramsPerMl, food.pieceGrams, food.sliceGrams].every(value => value === undefined || isPositive(value));
}
