import {nutrientKeys, type NutritionReference} from './foodValues';

export type LabelValues = Partial<Record<typeof nutrientKeys[number], number>>;
const patterns = {
  protein: /(?:eiwei(?:ß|ss)|protein[es]?)/i,
  carbs: /(?:kohlenhydrate|carbohydrates?)/i,
  sugar: /(?:zucker|sugars?)/i,
  fat: /(?:^|\s)(?:fett|fat)(?:\s|$|:)/i,
  fiber: /(?:ballaststoffe|fibre|fiber)/i,
};

// Conservative parsing: use a single chosen column; never treat missing values as zero.
export function parseLabelNutrition(text: string, column = 0): {values: LabelValues; reference?: NutritionReference; warnings: string[]} {
  const values: LabelValues = {};
  const lines = text.replace(/\u00a0/g, ' ').split(/\r?\n/);
  const warnings = ['Erkannte Werte und Bezugsmenge bitte anhand des Fotos prüfen.'];
  const header = text.match(/(?:pro|per|je|\/)\s*(\d+(?:[.,]\d+)?)\s*(ml|g)\b/i)
    ?? text.match(/\b(100)\s*(ml|g)\b/i);
  const amount = header ? Number(header[1].replace(',', '.')) : NaN;
  const reference: NutritionReference | undefined = header && amount > 0 ? {unit: header[2].toLowerCase() === 'ml' ? 'ml' : 'g', amount} : undefined;
  for (const line of lines) {
    const normalized = line.replace(/ß/g, 'ss');
    const energy = [...normalized.matchAll(/([<>≤≥]?)\s*(\d+(?:[.,]\d+)?)\s*(kcal|kj)\b/gi)];
    const kcal = energy.filter(match => match[3].toLowerCase() === 'kcal')[column];
    const kj = energy.filter(match => match[3].toLowerCase() === 'kj')[column];
    const selected = kcal ?? kj;
    if (selected && !selected[1]) values.kcal = Number(selected[2].replace(',', '.')) / (kcal ? 1 : 4.184);
    for (const [key, pattern] of Object.entries(patterns)) {
      if (key === 'fat' && /saturated|trans\s*fat|gesättigt|gesaettigt/i.test(normalized)) continue;
      const label = pattern.exec(normalized);
      if (!label) continue;
      const tail = normalized.slice(label.index + label[0].length);
      const numbers = [...tail.matchAll(/([<>≤≥]?)\s*(\d+(?:[.,]\d+)?)\s*(mg|g)?/gi)];
      const match = numbers[column];
      if (!match) continue;
      if (match[1]) {warnings.push('Angaben mit „kleiner als“ oder „größer als“ bitte selbst ergänzen.'); continue;}
      const value = Number(match[2].replace(',', '.')) / (match[3]?.toLowerCase() === 'mg' ? 1000 : 1);
      values[key as keyof LabelValues] = value;
    }
  }
  if (!reference) warnings.push('Die Bezugsmenge wurde nicht sicher erkannt. Bitte 100 g, 100 ml oder die passende Portion wählen.');
  if (column > 0) warnings.push('Zweite Wertespalte gewählt: Bitte ihre Bezugsmenge im Formular einstellen.');
  return {values, reference: column === 0 ? reference : undefined, warnings: [...new Set(warnings)]};
}
