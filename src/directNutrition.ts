import type {Entry, Food} from './db';
import {validFood} from './nutrition';
import {parseWeight} from './weight';

export const directNutrients = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'fiber'] as const;
export type DirectDraft = {name: string; amount: string; unitLabel: string; weight: string; estimated: boolean} & Record<typeof directNutrients[number], string>;
export function initialDirectDraft(entry: Entry | null): DirectDraft {
  const food = entry?.foodSnapshot, direct = food?.directNutrition;
  const values = Object.fromEntries(directNutrients.map(key => [key, direct && !direct.missing.includes(key as Exclude<typeof key, 'kcal'>) && food?.[key] !== null ? String(food![key]).replace('.', ',') : ''])) as Record<typeof directNutrients[number], string>;
  return {...values, name: direct ? food!.name : '', amount: direct ? String(direct.amount).replace('.', ',') : '1', unitLabel: direct?.unitLabel ?? 'Stück',
    weight: direct && entry!.grams > 0 ? String(entry!.grams).replace('.', ',') : '', estimated: direct?.estimated ?? false};
}
export function directDraftErrors(draft: DirectDraft): Partial<Record<keyof DirectDraft, string>> {
  const errors: Partial<Record<keyof DirectDraft, string>> = {};
  if (!draft.name.trim()) errors.name = 'Bitte eine Bezeichnung eingeben.';
  if (!Number.isFinite(parseWeight(draft.amount)) || parseWeight(draft.amount) <= 0) errors.amount = 'Bitte eine Menge größer als 0 eingeben.';
  if (!draft.unitLabel.trim()) errors.unitLabel = 'Bitte eine Einheit eingeben.';
  for (const key of directNutrients) {
    if ((key === 'kcal' || draft[key].trim()) && (!draft[key].trim() || !Number.isFinite(parseWeight(draft[key])) || parseWeight(draft[key]) < 0)) errors[key] = 'Bitte einen Wert ab 0 eingeben.';
  }
  if (draft.weight.trim() && (!Number.isFinite(parseWeight(draft.weight)) || parseWeight(draft.weight) <= 0)) errors.weight = 'Bitte ein Gewicht größer als 0 eingeben oder das Feld leeren.';
  return errors;
}
export function buildDirectEntry(draft: DirectDraft, context: {id: string; date: string; meal: string; note: string; original: Entry | null}): Entry {
  if (Object.keys(directDraftErrors(draft)).length) throw Error('Bitte die markierten Angaben prüfen.');
  const amount = parseWeight(draft.amount), grams = draft.weight.trim() ? parseWeight(draft.weight) : 0;
  const createdAt = context.original?.createdAt ?? new Date().toISOString();
  const food: Food = {id: context.original?.foodSnapshot.directNutrition ? context.original.foodId : `direct-${context.id}`, name: draft.name.trim(), brand: '',
    kcal: parseWeight(draft.kcal), protein: draft.protein.trim() ? parseWeight(draft.protein) : 0,
    carbs: draft.carbs.trim() ? parseWeight(draft.carbs) : 0, sugar: draft.sugar.trim() ? parseWeight(draft.sugar) : 0,
    fat: draft.fat.trim() ? parseWeight(draft.fat) : 0, fiber: draft.fiber.trim() ? parseWeight(draft.fiber) : null,
    portionName: draft.unitLabel.trim(), portionGrams: grams / amount, createdAt,
    directNutrition: {amount, unitLabel: draft.unitLabel.trim(), estimated: draft.estimated,
      missing: directNutrients.filter((key): key is Exclude<typeof key, 'kcal'> => key !== 'kcal' && !draft[key].trim())}};
  const entry: Entry = {id: context.id, foodId: food.id, date: context.date, meal: context.meal, grams, amount, unit: 'portion', foodSnapshot: food, createdAt,
    ...(context.note.trim() ? {note: context.note.trim()} : {})};
  if (!validDirectItem(entry)) throw Error('Bitte die markierten Angaben prüfen.');
  return entry;
}
export function validDirectItem(item: Pick<Entry, 'foodSnapshot' | 'amount' | 'unit' | 'grams'>): boolean {
  const food = item.foodSnapshot, direct = food.directNutrition;
  if (!direct || !validFood(food) || item.unit !== 'portion' || item.amount !== direct.amount || !Number.isFinite(item.grams) || item.grams < 0) return false;
  return Math.abs(food.portionGrams * direct.amount - item.grams) <= Math.max(1e-8, item.grams * 1e-9);
}
