import type {Food} from './db';
import {cleanBarcode, validBarcode} from './barcode';
import {nutrientKeys, type NutritionReference} from './foodValues';
import {isPositive} from './nutrition';

export type FoodFieldErrors = Record<string, string>;
export function foodEditorErrors(food: Food, reference: NutritionReference, needsReview = false, reviewed = false): FoodFieldErrors {
  const errors: FoodFieldErrors = {};
  if (!food.name.trim()) errors.name = 'Bitte einen Namen eingeben.';
  const barcode = cleanBarcode(food.barcode ?? '');
  if (barcode && !validBarcode(barcode)) errors.barcode = 'Bitte einen gültigen Barcode eingeben oder das Feld leeren.';
  if (!isPositive(reference.amount)) errors.referenceAmount = 'Bitte eine Bezugsmenge größer als 0 eingeben.';
  for (const key of nutrientKeys) {
    const value = food[key];
    if (key === 'fiber' && (value === null || Number.isNaN(value))) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) errors[key] = 'Bitte einen Wert ab 0 eingeben.';
  }
  if (!food.portionName.trim()) errors.portionName = 'Bitte die Standardportion benennen.';
  if (!isPositive(food.portionGrams)) errors.portionGrams = 'Bitte ein Gewicht größer als 0 eingeben.';
  const names = new Set<string>();
  for (const [index, portion] of (food.portions ?? []).entries()) {
    const name = portion.name.trim();
    if (!name) errors[`portions.${index}.name`] = 'Bitte diese Portion benennen.';
    else if (names.has(name) || name === food.portionName.trim() && portion.grams !== food.portionGrams) errors[`portions.${index}.name`] = 'Bitte einen eindeutigen Portionsnamen verwenden.';
    names.add(name);
    if (!isPositive(portion.grams)) errors[`portions.${index}.grams`] = 'Bitte ein Gewicht größer als 0 eingeben.';
  }
  for (const key of ['pieceGrams', 'sliceGrams', 'gramsPerMl'] as const) {
    if (food[key] !== undefined && !isPositive(food[key])) errors[key] = 'Bitte einen Wert größer als 0 eingeben oder das Feld leeren.';
  }
  if (reference.unit === 'ml' && !isPositive(food.gramsPerMl)) errors.gramsPerMl = 'Für Angaben pro 100 ml bitte die Dichte in g/ml eingeben.';
  if (needsReview && !reviewed) errors.reviewed = 'Bitte die übernommenen Angaben prüfen und bestätigen.';
  return errors;
}
