import type {Food} from './db';
import {cleanBarcode, validBarcode} from './barcode';
import {emptyFood} from './nutrition';
import {nutrientKeys} from './foodValues';

export const nutrientLabels = {kcal: 'Kalorien', protein: 'Eiweiß', carbs: 'Kohlenhydrate', sugar: 'Zucker', fat: 'Fett', fiber: 'Ballaststoffe'};
export type ImportedProduct = {food: Food; warnings: string[]; missing: (typeof nutrientKeys[number])[]};
const numeric = (value: unknown): number | undefined => {
  if (typeof value !== 'number' && typeof value !== 'string' || typeof value === 'string' && !value.trim()) return undefined;
  const result = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function blankImport(barcode?: string): Food {
  return {...emptyFood(), ...Object.fromEntries(nutrientKeys.map(key => [key, NaN])), ...(barcode ? {barcode} : {})};
}

export function mapOpenFoodFacts(data: unknown, barcode: string): ImportedProduct | null {
  const response = data as {status?: number; product?: Record<string, unknown>};
  if (!response || response.status === 0 || !response.product || typeof response.product !== 'object') return null;
  const product = response.product;
  const nutrients = product.nutriments && typeof product.nutriments === 'object' ? product.nutriments as Record<string, unknown> : {};
  const food = blankImport(barcode);
  food.name = text(product.product_name_de) || text(product.product_name) || text(product.generic_name_de) || text(product.generic_name);
  food.brand = text(product.brands);
  const keys = {kcal: 'energy-kcal', protein: 'proteins', carbs: 'carbohydrates', sugar: 'sugars', fat: 'fat', fiber: 'fiber'};
  for (const key of nutrientKeys) {
    let value = numeric(nutrients[`${keys[key]}_100g`]);
    if (key === 'kcal' && value === undefined) {
      const kj = numeric(nutrients['energy-kj_100g']) ?? (nutrients.energy_unit === 'kJ' ? numeric(nutrients.energy_100g) : undefined);
      if (kj !== undefined) value = kj / 4.184;
    }
    food[key] = value ?? NaN;
  }
  const unit = text(product.product_quantity_unit).toLowerCase();
  const servingUnit = text(product.serving_quantity_unit).toLowerCase();
  const serving = text(product.serving_size);
  const liquid = ['ml', 'l', 'cl'].includes(unit) || ['ml', 'l', 'cl'].includes(servingUnit) || /\b(?:ml|cl)\b/i.test(serving) || product.nutrition_data_per === '100ml';
  food.nutritionReference = {unit: liquid ? 'ml' : 'g', amount: 100};
  const servingGrams = serving.match(/(?:^|\()\s*(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (servingGrams && Number(servingGrams[1].replace(',', '.')) > 0) {
    food.portionGrams = Number(servingGrams[1].replace(',', '.')); food.portionName = serving || '1 Portion';
  }
  food.source = {type: 'openfoodfacts', importedAt: new Date().toISOString()};
  const warnings = ['Bitte Name, Bezugsmenge und Nährwerte mit der Verpackung vergleichen.'];
  if (liquid) warnings.push('Angaben pro 100 ml: Bitte die Dichte und das Portionsgewicht ergänzen. Es wird keine Dichte angenommen.');
  else warnings.push('Die übernommenen Werte gelten pro 100 g oder 100 ml. Bitte die passende Einheit laut Verpackung wählen.');
  return {food, warnings, missing: nutrientKeys.filter(key => !Number.isFinite(food[key]))};
}

export async function lookupProduct(rawBarcode: string, signal?: AbortSignal): Promise<ImportedProduct | null> {
  const barcode = cleanBarcode(rawBarcode);
  if (!validBarcode(barcode)) throw Error('Bitte einen gültigen EAN-/UPC-Barcode mit 8, 12, 13 oder 14 Ziffern eingeben.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw Error('Du bist offline. Gespeicherte Produkte sind verfügbar; für neue Produktdaten ist Internet nötig.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, {once: true});
  const timeout = setTimeout(cancel, 15000);
  try {
    const fields = 'product_name,product_name_de,generic_name,generic_name_de,brands,nutriments,serving_size,serving_quantity_unit,product_quantity_unit,nutrition_data_per';
    const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    url.searchParams.set('fields', fields);
    // Browsers own the User-Agent header; OFF accepts app identification in the query.
    url.searchParams.set('app_name', 'Ernaehrungstagebuch');
    url.searchParams.set('app_version', '1.0');
    const response = await fetch(url, {signal: controller.signal});
    if (response.status === 404) return null;
    if (response.status === 429) throw Error('Zu viele Produktabfragen. Bitte warte einen Moment und versuche es erneut.');
    if (!response.ok) throw Error('Die Produktdatenbank ist gerade nicht erreichbar. Bitte später erneut versuchen.');
    return mapOpenFoodFacts(await response.json(), barcode);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw Error('Die Produktabfrage hat zu lange gedauert. Bitte erneut versuchen.');
    if (error instanceof TypeError) throw Error('Produktdaten konnten nicht geladen werden. Bitte Internetverbindung prüfen oder manuell anlegen.');
    throw error;
  } finally {clearTimeout(timeout); signal?.removeEventListener('abort', cancel);}
}
