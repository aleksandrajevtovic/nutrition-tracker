import type {Food} from './db';

export const nutrientKeys = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'fiber'] as const;
export type NutritionReference = NonNullable<Food['nutritionReference']>;
export const defaultReference: NutritionReference = {unit: 'g', amount: 100};

export function referenceGrams(food: Food, reference: NutritionReference): number {
  return reference.amount * (reference.unit === 'portion' ? food.portionGrams : reference.unit === 'ml' ? food.gramsPerMl ?? NaN : 1);
}

// Keep the calculation model per 100 g; only the editor's input/output basis changes.
export function scaleNutrients(food: Food, factor: number): Food {
  return {...food, ...Object.fromEntries(nutrientKeys.map(key => [key, food[key] * factor]))};
}

export function portionOptions(food: Food) {
  return [{name: food.portionName, grams: food.portionGrams}, ...(food.portions ?? [])]
    .filter((portion, index, all) => all.findIndex(other => other.name === portion.name) === index);
}

export function selectPortion(food: Food, name: string): Food {
  const options = portionOptions(food);
  const portion = options.find(option => option.name === name);
  // Freeze the selected size in the snapshot; never change the product in the library.
  return portion ? {...food, portionName: portion.name, portionGrams: portion.grams, portions: options} : food;
}
