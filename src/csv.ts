import type {Entry} from './db';
import {stats, nutrientAmount, missingNutrients, fiberIncomplete} from './nutrition';
import {validDate, type WeightRecord} from './weight';
import type {Drink} from './hydration';
import {calendarWeek} from './week';

export type CsvRange = {from?: string; to?: string};
export const csvHeaders = ['Datum', 'Einträge', 'Kalorien (kcal)', 'Eiweiß (g)', 'Kohlenhydrate (g)', 'Fett (g)', 'Ballaststoffe (g)', 'Zucker (g)', 'Gewicht (kg)', 'Trinkmenge (ml)'];
export const weeklyCsvHeaders = ['Wochenbeginn', 'Wochenende', 'Ausgewertet ab', 'Ausgewertet bis', 'Tage mit Lebensmitteln',
  'Ø Kalorien (kcal)', 'Ø Eiweiß (g)', 'Ø Kohlenhydrate (g)', 'Ø Fett (g)', 'Ø Ballaststoffe (g)', 'Ø Zucker (g)',
  'Gewichtsmessungen', 'Ø Gewicht (kg)', 'Tage mit Getränken', 'Trinkmenge gesamt (ml)', 'Ø Trinkmenge (ml je erfasstem Tag)'];
const nutrients = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar'] as const;
type CsvDay = {count: number; kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; fiberIncomplete?: boolean; missing?: string[]; weight?: number; drinkMl?: number};

function collectDays(entries: Entry[], weights: WeightRecord[], range: CsvRange, drinks: Drink[]) {
  if ((range.from && !validDate(range.from)) || (range.to && !validDate(range.to)) || (range.from && range.to && range.from > range.to)) {
    throw Error('Bitte einen gültigen Zeitraum für den CSV-Export wählen.');
  }
  const days = new Map<string, CsvDay>();
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
    if (fiberIncomplete([entry])) current.fiberIncomplete = true;
    current.missing = [...new Set([...(current.missing ?? []), ...missingNutrients([entry])])];
    for (const key of Object.keys(values) as (keyof typeof values)[]) current[key] += values[key];
    current.sugar += nutrientAmount(entry.foodSnapshot, entry.grams, 'sugar');
  }
  for (const weight of weights) if (includes(weight.date)) day(weight.date).weight = weight.kg;
  for (const drink of drinks) if (includes(drink.date)) {
    if (!Number.isFinite(drink.ml) || drink.ml <= 0) throw Error('Ungültige Daten für den CSV-Export');
    const values = day(drink.date); values.drinkMl = (values.drinkMl ?? 0) + drink.ml;
  }
  return days;
}
const number = (value: number) => {
  if (!Number.isFinite(value)) throw Error('Ungültige Daten für den CSV-Export');
  return value.toLocaleString('de-DE', {useGrouping: false, maximumFractionDigits: 3});
};
function csvDocument(headers: string[], rows: string[][]) {
  // UTF-8 BOM, CRLF and semicolon-separated German decimals work in common spreadsheet programs.
  const cell = (value: string) => /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return {csv: '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n', rowCount: rows.length};
}

export function dailyCsv(entries: Entry[], weights: WeightRecord[], range: CsvRange = {}, drinks: Drink[] = []) {
  const rows = [...collectDays(entries, weights, range, drinks)].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => [
    date, String(values.count), ...nutrients.map(key => values.count && !values.missing?.includes(key) && !(key === 'fiber' && values.fiberIncomplete) ? number(values[key]) : ''),
    values.weight === undefined ? '' : number(values.weight), values.drinkMl === undefined ? '' : number(values.drinkMl),
  ]);
  return csvDocument(csvHeaders, rows);
}

export function weeklyCsv(entries: Entry[], weights: WeightRecord[], range: CsvRange = {}, drinks: Drink[] = []) {
  const weeks = new Map<string, CsvDay[]>();
  for (const [date, day] of collectDays(entries, weights, range, drinks)) {
    const start = calendarWeek(date).start;
    if (!weeks.has(start)) weeks.set(start, []);
    weeks.get(start)!.push(day);
  }
  const rows = [...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([start, days]) => {
    const {end} = calendarWeek(start);
    const recorded = days.filter(day => day.count > 0);
    const measured = days.filter(day => day.weight !== undefined);
    const hydrated = days.filter(day => day.drinkMl !== undefined);
    const drinkTotal = hydrated.reduce((sum, day) => sum + day.drinkMl!, 0);
    return [start, end, range.from && range.from > start ? range.from : start, range.to && range.to < end ? range.to : end,
      String(recorded.length), ...nutrients.map(key => recorded.length && !recorded.some(day => day.missing?.includes(key)) && !(key === 'fiber' && recorded.some(day => day.fiberIncomplete)) ? number(recorded.reduce((sum, day) => sum + day[key], 0) / recorded.length) : ''),
      String(measured.length), measured.length ? number(measured.reduce((sum, day) => sum + day.weight!, 0) / measured.length) : '',
      String(hydrated.length), hydrated.length ? number(drinkTotal) : '', hydrated.length ? number(drinkTotal / hydrated.length) : ''];
  });
  return csvDocument(weeklyCsvHeaders, rows);
}
