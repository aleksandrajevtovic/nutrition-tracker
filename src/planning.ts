import type {Entry, Food} from './db';
import {isPositive, stats, toGrams, units, validFood, type Unit} from './nutrition';
import {validRecipeFood} from './recipes';
import {validDate} from './weight';
import {validEntryNote} from './diary';

export type MealItem = {foodId: string; grams: number; amount?: number; unit?: Unit; note?: string; foodSnapshot: Food};
export type MealTemplate = {id: string; name: string; meal: string; items: MealItem[]; createdAt: string};
export type MealPlan = {id: string; name: string; date: string; meal: string; items: MealItem[]; createdAt: string; status: 'planned' | 'logged'; entryIds: string[]};
export type ShoppingItem = {id: string; foodId: string; name: string; brand: string; grams: number; checked: boolean};
export type ShoppingList = {items: ShoppingItem[]; updatedAt: string | null};
export type WorkspaceBackup = {templates: MealTemplate[]; plans: MealPlan[]; shoppingList: ShoppingList};
export const emptyShoppingList = (): ShoppingList => ({items: [], updatedAt: null});
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const unique = (values: {id: string}[]) => new Set(values.map(value => value.id)).size === values.length;

export function validMealItem(value: unknown): value is MealItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as MealItem;
  const food = item.foodSnapshot;
  if (!text(item.foodId) || !isPositive(item.grams) || !food || !text(food.id) || !text(food.name)
    || typeof food.brand !== 'string' || typeof food.portionName !== 'string' || !timestamp(food.createdAt)
    || food.id !== item.foodId || !validFood(food) || (food.recipe !== undefined && !validRecipeFood(food))
    || !Object.values(stats(food, item.grams)).every(Number.isFinite) || !validEntryNote(item.note)) return false;
  if (item.amount === undefined && item.unit === undefined) return true;
  if (!isPositive(item.amount) || !units.includes(item.unit!)) return false;
  const grams = toGrams(food, item.amount, item.unit!);
  return isPositive(grams) && Math.abs(grams - item.grams) <= Math.max(1e-8, item.grams * 1e-9);
}
export function validTemplate(value: unknown): value is MealTemplate {
  const template = value as MealTemplate;
  return Boolean(template && text(template.id) && text(template.name) && text(template.meal) && timestamp(template.createdAt)
    && Array.isArray(template.items) && template.items.length > 0 && template.items.every(validMealItem));
}
export function validPlan(value: unknown): value is MealPlan {
  const plan = value as MealPlan;
  return validTemplate(plan) && validDate(plan.date) && ['planned', 'logged'].includes(plan.status)
    && Array.isArray(plan.entryIds) && plan.entryIds.every(text) && new Set(plan.entryIds).size === plan.entryIds.length
    && (plan.status === 'planned' ? plan.entryIds.length === 0 : plan.entryIds.length === plan.items.length);
}
export function validShopping(value: unknown): value is ShoppingList {
  const list = value as ShoppingList;
  return Boolean(list && Array.isArray(list.items) && (list.updatedAt === null || timestamp(list.updatedAt))
    && list.items.every(item => item && text(item.id) && text(item.foodId) && item.id === item.foodId && text(item.name)
      && typeof item.brand === 'string' && isPositive(item.grams) && typeof item.checked === 'boolean') && unique(list.items));
}
export function backupWorkspace(value: {version?: unknown; templates?: unknown; plans?: unknown; shoppingList?: unknown}): WorkspaceBackup | undefined {
  if (value.version !== 4 && value.version !== 5 && value.version !== 6) return undefined;
  if (!Array.isArray(value.templates) || !value.templates.every(validTemplate) || !unique(value.templates)
    || !Array.isArray(value.plans) || !value.plans.every(validPlan) || !unique(value.plans) || !validShopping(value.shoppingList)) {
    throw Error('Ungültige Vorlagen, Einkaufslisten oder Planungsdaten');
  }
  return {templates: value.templates, plans: value.plans, shoppingList: value.shoppingList};
}

export function itemsFromEntries(entries: Entry[]): MealItem[] {
  return entries.map(({foodId, grams, amount, unit, note, foodSnapshot}) => ({foodId, grams, amount, unit, ...(note !== undefined ? {note} : {}), foodSnapshot: structuredClone(foodSnapshot)}));
}
export function itemFromFood(food: Food, amount: number, unit: Unit): MealItem {
  return {foodId: food.id, amount, unit, grams: toGrams(food, amount, unit), foodSnapshot: structuredClone(food)};
}
export function scaleItems(items: MealItem[], factor: number): MealItem[] {
  if (!isPositive(factor) || !items.length || !items.every(validMealItem)) throw Error('Bitte eine gültige Vorlage und einen positiven Faktor wählen.');
  const scaled = items.map(item => ({...structuredClone(item), grams: item.grams * factor,
    ...(item.amount !== undefined ? {amount: item.amount * factor} : {})}));
  if (!scaled.every(validMealItem)) throw Error('Ungültige Planungsmenge');
  return scaled;
}
export function itemsToEntries(items: MealItem[], date: string, meal: string, factor = 1): Entry[] {
  if (!validDate(date) || !text(meal)) throw Error('Bitte ein gültiges Zieldatum und eine Mahlzeit wählen.');
  const now = Date.now();
  return scaleItems(items, factor).map((item, index) => ({...item, id: crypto.randomUUID(), date, meal: meal.trim(), createdAt: new Date(now + index).toISOString()}));
}
export function mealTotals(items: MealItem[]) {
  return items.reduce((sum, item) => {
    const values = stats(item.foodSnapshot, item.grams);
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += values[key];
    return sum;
  }, {kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0});
}

export function shoppingFromMeals(items: MealItem[]): ShoppingItem[] {
  if (!items.length || !items.every(validMealItem)) throw Error('Bitte mindestens ein Rezept oder eine geplante Mahlzeit wählen.');
  const result = new Map<string, ShoppingItem>();
  const add = (food: Food, grams: number) => {
    const existing = result.get(food.id);
    if (existing) existing.grams += grams;
    else result.set(food.id, {id: food.id, foodId: food.id, name: food.name, brand: food.brand, grams, checked: false});
  };
  for (const item of items) {
    const recipe = item.foodSnapshot.recipe;
    if (recipe) {
      for (const ingredient of recipe.ingredients) add(ingredient.foodSnapshot, ingredient.grams * item.grams / recipe.yieldGrams);
    } else add(item.foodSnapshot, item.grams);
  }
  const list = {items: [...result.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')), updatedAt: null};
  if (!validShopping(list)) throw Error('Ungültige Einkaufsmenge');
  return list.items;
}
export function mergeShopping(current: ShoppingItem[], additions: ShoppingItem[]): ShoppingItem[] {
  const result = new Map(current.map(item => [item.id, {...item}]));
  for (const item of additions) {
    const previous = result.get(item.id);
    result.set(item.id, {...item, grams: item.grams + (previous?.grams ?? 0), checked: false});
  }
  const items = [...result.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  if (!validShopping({items, updatedAt: null})) throw Error('Ungültige Einkaufsmenge');
  return items;
}
