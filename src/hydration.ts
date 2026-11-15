import {parseWeight, validDate} from './weight';

export type Drink = {id: string; date: string; time: string; name: string; ml: number; createdAt: string};
export type DrinkUnit = 'ml' | 'l';
export const validDrinkTime = (time: unknown): time is string => typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
export const drinkTimeNow = () => {const date = new Date(); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;};

export function drinkMilliliters(value: string, unit: DrinkUnit): number {
  const amount = parseWeight(value);
  const ml = amount * (unit === 'l' ? 1000 : 1);
  return (unit === 'ml' || unit === 'l') && Number.isFinite(ml) && ml > 0 ? ml : NaN;
}
export function validDrink(value: unknown): value is Drink {
  const drink = value as Drink;
  return Boolean(drink && typeof drink.id === 'string' && drink.id.trim() && validDate(drink.date) && validDrinkTime(drink.time)
    && typeof drink.name === 'string' && drink.name.trim() && typeof drink.ml === 'number' && Number.isFinite(drink.ml) && drink.ml > 0
    && typeof drink.createdAt === 'string' && Number.isFinite(Date.parse(drink.createdAt)));
}
export function createDrink(date: string, name: string, value: string, unit: DrinkUnit, time: string, previous?: Drink): Drink {
  const drink: Drink = {id: previous?.id ?? crypto.randomUUID(), date, name: name.trim(), ml: drinkMilliliters(value, unit), time,
    createdAt: previous?.createdAt ?? new Date().toISOString()};
  if (!validDrink(drink)) throw Error('Bitte Getränk, eine positive Trinkmenge und eine gültige Uhrzeit eingeben.');
  return drink;
}
export function drinkTimeline(drinks: Drink[]) {
  let total = 0;
  return [...drinks].sort((a, b) => a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map(drink => ({...drink, totalMl: total += drink.ml}));
}
export function backupDrinks(backup: {version?: unknown; drinks?: unknown}): Drink[] | undefined {
  if (backup.version !== 6) return undefined;
  if (!Array.isArray(backup.drinks) || !backup.drinks.every(validDrink)
    || new Set(backup.drinks.map(drink => drink.id)).size !== backup.drinks.length) throw Error('Ungültige Trinkdaten');
  return backup.drinks;
}
