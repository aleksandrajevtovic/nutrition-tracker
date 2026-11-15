import type {Entry} from './db';
import {stats} from './nutrition';
import {validDate, type WeightRecord} from './weight';

export type CsvRange = {from?: string; to?: string};
export const csvHeaders = ['Datum', 'Einträge', 'Kalorien (kcal)', 'Protein (g)', 'Kohlenhydrate (g)', 'Fett (g)', 'Ballaststoffe (g)', 'Zucker (g)', 'Gewicht (kg)'];

export function dailyCsv(entries: Entry[], weights: WeightRecord[], range: CsvRange = {}) {
  if ((range.from && !validDate(range.from)) || (range.to && !validDate(range.to)) || (range.from && range.to && range.from > range.to)) {
    throw Error('Bitte einen gültigen Zeitraum für den CSV-Export wählen.');
  }
  const days = new Map<string, {count: number; kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; weight?: number}>();
  const includes = (date: string) => {
    if (!validDate(date)) throw Error('Ungültige Daten für den CSV-Export');
    return (!range.from || date >= range.from) && (!range.to || date <= range.to);
  };
  const day = (date: string) => {
    if (!days.has(date)) days.set(date, {count: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0});
    return days.get(date)!;
  };
  for (const entry of entries) {
    if (!includes(entry.date)) continue;
    const current = day(entry.date);
    const values = stats(entry.foodSnapshot, entry.grams);
    current.count++;
    for (const key of Object.keys(values) as (keyof typeof values)[]) current[key] += values[key];
    current.sugar += entry.foodSnapshot.sugar / 100 * entry.grams;
  }
  for (const weight of weights) if (includes(weight.date)) day(weight.date).weight = weight.kg;
  const number = (value: number) => {
    if (!Number.isFinite(value)) throw Error('Ungültige Daten für den CSV-Export');
    return value.toLocaleString('de-DE', {useGrouping: false, maximumFractionDigits: 3});
  };
  const rows = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => [
    date, String(values.count), ...(['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar'] as const).map(key => values.count ? number(values[key]) : ''),
    values.weight === undefined ? '' : number(values.weight),
  ]);
  // UTF-8 BOM, CRLF and semicolon-separated German decimals work in common spreadsheet programs.
  const cell = (value: string) => /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return {csv: '\uFEFF' + [csvHeaders, ...rows].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n', rowCount: rows.length};
}
