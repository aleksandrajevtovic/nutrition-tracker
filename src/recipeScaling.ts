import type {Recipe} from './recipes';
import {isPositive} from './nutrition';

// Derived cooking quantities only; never modify the saved recipe or ingredient snapshots.
export function recipeForServings(recipe: Recipe, servings: number): Recipe | undefined {
  const factor = servings / recipe.servings;
  if (!isPositive(servings) || !isPositive(factor)) return undefined;
  const yieldGrams = recipe.yieldGrams * factor;
  const ingredients = recipe.ingredients.map(ingredient => ({...ingredient, amount: ingredient.amount * factor, grams: ingredient.grams * factor}));
  if (!isPositive(yieldGrams) || ingredients.some(ingredient => !isPositive(ingredient.amount) || !isPositive(ingredient.grams))) return undefined;
  return {...recipe, servings, yieldGrams, ingredients};
}
