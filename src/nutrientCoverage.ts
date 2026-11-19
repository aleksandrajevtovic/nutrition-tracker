import type {Food} from './db';
import type {GoalKey} from './goals';

export const nutrientMissing = (food: Food, key: GoalKey | 'sugar') => key === 'fiber' && food.fiber === null && food.entryFiber === undefined
  || Boolean(food.directNutrition?.missing.includes(key as Exclude<GoalKey | 'sugar', 'kcal'>));

export function nutrientCoverage(items: {foodSnapshot: Food}[], key: GoalKey) {
  return {missing: items.some(item => nutrientMissing(item.foodSnapshot, key)),
    hasKnown: items.some(item => !nutrientMissing(item.foodSnapshot, key))};
}
