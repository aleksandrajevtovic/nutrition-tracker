import type {Entry, Food} from './db';
import {isPositive, toGrams, validFood, type Unit} from './nutrition';
import {portionOptions, selectPortion} from './foodValues';
import {validDate} from './weight';

export type RecentFood = {food: Food; amount: number; unit: Unit; grams: number};

export function recentFoods(entries: Entry[], foods: Food[], limit = 6): RecentFood[] {
  if (limit <= 0) return [];
  const products = new Map(foods.map(food => [food.id, food]));
  const seen = new Set<string>();
  const result: RecentFood[] = [];
  for (const entry of [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.date.localeCompare(a.date) || b.id.localeCompare(a.id))) {
    let food = products.get(entry.foodId);
    if (!food || seen.has(food.id) || !validFood(food)) continue;
    seen.add(food.id);
    let unit = entry.unit ?? 'g';
    let amount = entry.amount ?? entry.grams;
    if (unit === 'portion') {
      if (portionOptions(food).some(portion => portion.name === entry.foodSnapshot.portionName)) food = selectPortion(food, entry.foodSnapshot.portionName);
      else {unit = 'g'; amount = entry.grams;}
    }
    if (!isPositive(toGrams(food, amount, unit))) {unit = 'g'; amount = entry.grams;}
    const grams = toGrams(food, amount, unit);
    if (isPositive(amount) && isPositive(grams)) result.push({food, amount, unit, grams});
    if (result.length >= limit) break;
  }
  return result;
}

export type DiaryQuery = {text: string; from: string; to: string};
export const validDiaryRange = ({from, to}: Pick<DiaryQuery, 'from' | 'to'>) => (!from || validDate(from)) && (!to || validDate(to)) && (!from || !to || from <= to);
const normalize = (text: string) => text.toLocaleLowerCase('de-DE').replaceAll('ß', 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function searchDiary(entries: Entry[], query: DiaryQuery): Entry[] {
  if (!validDiaryRange(query)) return [];
  const terms = normalize(query.text).trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    if ((query.from && entry.date < query.from) || (query.to && entry.date > query.to)) return false;
    const text = normalize([entry.foodSnapshot.name, entry.foodSnapshot.brand, entry.meal, entry.note ?? ''].join(' '));
    return terms.every(term => text.includes(term));
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
