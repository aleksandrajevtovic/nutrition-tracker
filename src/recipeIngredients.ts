import type {RecipeIngredient} from './recipes';
import {gramsPerUnit, isPositive, toGrams, type Unit} from './nutrition';

export function changeIngredientUnit(ingredient: RecipeIngredient, unit: Unit): RecipeIngredient {
  const factor=gramsPerUnit(ingredient.foodSnapshot,unit);
  if(!isPositive(factor))return ingredient;
  const amount=isPositive(ingredient.grams) ? Number((ingredient.grams/factor).toPrecision(12)) : ingredient.amount;
  return {...ingredient,unit,amount,grams:toGrams(ingredient.foodSnapshot,amount,unit)};
}
