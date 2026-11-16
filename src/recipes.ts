import type {Food} from './db';
import {emptyFood, fiberIncomplete, isPositive, toGrams, units, validFood, type Unit} from './nutrition';

export type RecipeIngredient = {id: string; amount: number; unit: Unit; grams: number; foodSnapshot: Food};
export type Recipe = {servings: number; yieldGrams: number; autoWeight?: boolean; ingredients: RecipeIngredient[]; instructions: string};
export const recipeNutrients = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar'] as const;

export function makeIngredient(food: Food, amount: number, unit: Unit): RecipeIngredient {
  // Another recipe may be an ingredient; freeze its calculated nutrients without nesting its whole recipe.
  const {recipe: _recipe, ...snapshot} = structuredClone(food);
  return {id: crypto.randomUUID(), amount, unit, grams: toGrams(snapshot, amount, unit), foodSnapshot: snapshot};
}

export function validIngredient(value: unknown): value is RecipeIngredient {
  if (!value || typeof value !== 'object') return false;
  const ingredient = value as RecipeIngredient;
  const food = ingredient.foodSnapshot;
  if (typeof ingredient.id !== 'string' || !ingredient.id || !isPositive(ingredient.amount)
    || !isPositive(ingredient.grams) || !units.includes(ingredient.unit)
    || !food || typeof food.id !== 'string' || typeof food.name !== 'string' || typeof food.brand !== 'string'
    || typeof food.portionName !== 'string' || typeof food.createdAt !== 'string' || food.recipe !== undefined || !validFood(food)) return false;
  const converted = toGrams(food, ingredient.amount, ingredient.unit);
  return isPositive(converted) && Math.abs(converted - ingredient.grams) <= Math.max(1e-8, ingredient.grams * 1e-9);
}

export function recipeTotals(ingredients: RecipeIngredient[]) {
  const totals = {kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0};
  let grams = 0;
  for (const ingredient of ingredients) {
    grams += ingredient.grams;
    for (const key of recipeNutrients) totals[key] += (ingredient.foodSnapshot[key] ?? 0) / 100 * ingredient.grams;
  }
  return {grams, ...totals};
}

export function validRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Recipe;
  return isPositive(recipe.servings) && isPositive(recipe.yieldGrams) && typeof recipe.instructions === 'string'
    && (recipe.autoWeight === undefined || typeof recipe.autoWeight === 'boolean')
    && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && recipe.ingredients.every(validIngredient)
    && new Set(recipe.ingredients.map(ingredient => ingredient.id)).size === recipe.ingredients.length
    && Object.values(recipeTotals(recipe.ingredients)).every(value => Number.isFinite(value) && value >= 0)
    && (recipe.autoWeight !== true || Math.abs(recipe.yieldGrams - recipeTotals(recipe.ingredients).grams) <= Math.max(1e-8, recipe.yieldGrams * 1e-9));
}

export function buildRecipeFood(base: Food, recipe: Recipe): Food {
  if (!validRecipe(recipe)) throw Error('Bitte gültige Zutaten, eine positive Portionsanzahl und ein positives Gesamtgewicht eingeben.');
  const totals = recipeTotals(recipe.ingredients);
  const nutrients = Object.fromEntries(recipeNutrients.map(key => [key, totals[key] / recipe.yieldGrams * 100]));
  const food = {...base, ...nutrients, ...(fiberIncomplete(recipe.ingredients) ? {fiber:null} : {}), portionName: '1 Portion', portionGrams: recipe.yieldGrams / recipe.servings, recipe} as Food;
  if (!validFood(food)) throw Error('Ungültige Rezeptdaten');
  return food;
}

export function validRecipeFood(food: Food): boolean {
  if (!validRecipe(food.recipe) || food.recipe.ingredients.some(ingredient => ingredient.foodSnapshot.id === food.id)) return false;
  const calculated = buildRecipeFood(food, food.recipe);
  return ([...recipeNutrients, 'portionGrams'] as const).every(key => {
    const value=food[key], expected=calculated[key];
    if (key === 'fiber' && (value === null || expected === null)) return value === expected;
    return typeof value === 'number' && typeof expected === 'number' && Number.isFinite(value)
      && Math.abs(value-expected) <= Math.max(1e-8,Math.abs(expected)*1e-9);
  });
}

export const emptyRecipeFood = (): Food => ({...emptyFood(), brand: 'Eigenes Rezept', portionName: '1 Portion', recipe: {servings: 1, yieldGrams: 0, autoWeight: true, ingredients: [], instructions: ''}});
