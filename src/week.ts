import type {Entry} from './db';
import {fiberIncomplete, stats, missingNutrients} from './nutrition';
import {validDate, type WeightRecord} from './weight';
import type {Drink} from './hydration';

export type NutritionTotals = ReturnType<typeof stats>;
export const emptyTotals = (): NutritionTotals => ({kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0});

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function calendarWeek(date: string) {
  if (!validDate(date)) throw Error('Bitte ein gültiges Datum für die Wochenübersicht wählen.');
  const value = new Date(`${date}T00:00:00Z`);
  const start = shiftDate(date, -((value.getUTCDay() + 6) % 7));
  const thursday = new Date(`${shiftDate(start, 3)}T00:00:00Z`);
  const year = thursday.getUTCFullYear();
  const number = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return {start, end: shiftDate(start, 6), number, year, dates: Array.from({length: 7}, (_, index) => shiftDate(start, index))};
}

export function summarizeWeek(entries: Entry[], weights: WeightRecord[], date: string, drinks: Drink[] = [], options: {completedDays?: string[]; onlyCompleted?: boolean} = {}) {
  const week = calendarWeek(date);
  const completed = new Set(options.completedDays);
  const days = week.dates.map(date => {
    const matches = entries.filter(entry => entry.date === date);
    const totals = matches.reduce((sum, entry) => {
      const values = stats(entry.foodSnapshot, entry.grams);
      for (const key of Object.keys(sum) as (keyof NutritionTotals)[]) sum[key] += values[key];
      return sum;
    }, emptyTotals());
    const dayDrinks = drinks.filter(drink => drink.date === date);
    return {date, completed: completed.has(date), count: matches.length, totals, missing: missingNutrients(matches), fiberIncomplete: fiberIncomplete(matches), weight: weights.find(record => record.date === date)?.kg,
      drinkCount: dayDrinks.length, drinkMl: dayDrinks.length ? dayDrinks.reduce((sum, drink) => sum + drink.ml, 0) : undefined};
  });
  const recorded = days.filter(day => day.count > 0);
  const averaged = options.onlyCompleted ? recorded.filter(day => day.completed) : recorded;
  const measured = days.filter(day => day.weight !== undefined);
  const hydrated = days.filter(day => day.drinkMl !== undefined);
  const drinkTotalMl = hydrated.reduce((sum, day) => sum + day.drinkMl!, 0);
  const drinkAverageMl = hydrated.length ? drinkTotalMl / hydrated.length : undefined;
  const totals = days.reduce((sum, day) => {
    for (const key of Object.keys(sum) as (keyof NutritionTotals)[]) sum[key] += day.totals[key];
    return sum;
  }, emptyTotals());
  const averageTotals = averaged.reduce((sum, day) => {
    for (const key of Object.keys(sum) as (keyof NutritionTotals)[]) sum[key] += day.totals[key];
    return sum;
  }, emptyTotals());
  const averages = averaged.length ? Object.fromEntries(Object.entries(averageTotals).map(([key, value]) => [key, value / averaged.length])) as NutritionTotals : undefined;
  const weightAverage = measured.length ? measured.reduce((sum, day) => sum + day.weight!, 0) / measured.length : undefined;
  const weightChange = measured.length > 1 ? Number((measured[measured.length - 1].weight! - measured[0].weight!).toFixed(3)) : undefined;
  return {...week, days, totals, averages, missing: [...new Set(averaged.flatMap(day => day.missing))], fiberIncomplete: averaged.some(day => day.fiberIncomplete), weightAverage, weightChange, recordedDays: recorded.length, averagedDays: averaged.length, measuredDays: measured.length,
    drinkTotalMl, drinkAverageMl, drinkingDays: hydrated.length};
}
export type WeekSummary = ReturnType<typeof summarizeWeek>;

export const weekDay = (date: string, long = false) => new Date(`${date}T00:00:00Z`).toLocaleDateString('de-DE', {weekday: long ? 'long' : 'short', timeZone: 'UTC'});
