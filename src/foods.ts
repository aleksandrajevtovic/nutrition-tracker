import type {Food} from './db';

export function filterFoods(foods: Food[], query: string, favoritesOnly = false): Food[] {
  const terms = query.trim().toLocaleLowerCase('de-DE').split(/\s+/).filter(Boolean);
  return foods.filter(food => {
    const text = `${food.name} ${food.brand}`.toLocaleLowerCase('de-DE');
    return (!favoritesOnly || food.favorite === true) && terms.every(term => text.includes(term));
  }).sort((a, b) => Number(b.favorite === true) - Number(a.favorite === true) || a.name.localeCompare(b.name, 'de'));
}
