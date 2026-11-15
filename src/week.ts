import type {Entry} from './db';
import {stats} from './nutrition';
import {validDate, type WeightRecord} from './weight';

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

export function summarizeWeek(entries: Entry[], weights: WeightRecord[], date: string) {
  const week = calendarWeek(date);
  const days = week.dates.map(date => {
    const matches = entries.filter(entry => entry.date === date);
    const totals = matches.reduce((sum, entry) => {
      const values = stats(entry.foodSnapshot, entry.grams);
      for (const key of Object.keys(sum) as (keyof NutritionTotals)[]) sum[key] += values[key];
      return sum;
    }, emptyTotals());
    return {date, count: matches.length, totals, weight: weights.find(record => record.date === date)?.kg};
  });
  const recorded = days.filter(day => day.count > 0);
  const measured = days.filter(day => day.weight !== undefined);
  const totals = days.reduce((sum, day) => {
    for (const key of Object.keys(sum) as (keyof NutritionTotals)[]) sum[key] += day.totals[key];
    return sum;
  }, emptyTotals());
  const averages = recorded.length ? Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value / recorded.length])) as NutritionTotals : undefined;
  const weightAverage = measured.length ? measured.reduce((sum, day) => sum + day.weight!, 0) / measured.length : undefined;
  const weightChange = measured.length > 1 ? Number((measured[measured.length - 1].weight! - measured[0].weight!).toFixed(3)) : undefined;
  return {...week, days, totals, averages, weightAverage, weightChange, recordedDays: recorded.length, measuredDays: measured.length};
}
export type WeekSummary = ReturnType<typeof summarizeWeek>;

export const weekDay = (date: string, long = false) => new Date(`${date}T00:00:00Z`).toLocaleDateString('de-DE', {weekday: long ? 'long' : 'short', timeZone: 'UTC'});
