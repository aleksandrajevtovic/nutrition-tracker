import type {Food} from './db';
import {fmt, unitLabels, type Unit} from './nutrition';

// Only remove an explicit single unit, never counts such as "2 Scheiben".
export const portionNameLabel = (name: string) => name.trim().replace(/^1\s+(?:x\s+|×\s*)?/i,'');
const unitNames: Record<string, readonly [string,string]> = {
  portion:['Portion','Portionen'],becher:['Becher','Becher'],stück:['Stück','Stück'],scheibe:['Scheibe','Scheiben'],
  esslöffel:['Esslöffel','Esslöffel'],teelöffel:['Teelöffel','Teelöffel'],el:['EL','EL'],tl:['TL','TL'],
  glas:['Glas','Gläser'],tasse:['Tasse','Tassen'],flasche:['Flasche','Flaschen'],dose:['Dose','Dosen'],
  packung:['Packung','Packungen'],teller:['Teller','Teller'],riegel:['Riegel','Riegel'],filet:['Filet','Filets'],
  schüssel:['Schüssel','Schüsseln'],handvoll:['Handvoll','Handvoll'],
  ei:['Ei','Eier'],banane:['Banane','Bananen'],apfel:['Apfel','Äpfel'],kartoffel:['Kartoffel','Kartoffeln'],cracker:['Cracker','Cracker'],
};

export function portionUnitLabel(amount: number, name: string): string {
  const label=portionNameLabel(name);
  const key=label.toLocaleLowerCase('de-DE');
  const unit=Object.hasOwn(unitNames,key) ? unitNames[key] : undefined;
  // Free-form size names remain multiplicative; do not guess their grammar.
  return unit ? unit[amount > 0 && amount <= 1 ? 0 : 1] : `× ${label}`;
}
export function portionQuantity(amount: number, name: string, grams?: number, digits=3): string {
  if (!Number.isFinite(amount)) return '—';
  const weightLabel = name.trim().match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|mg)$/i);
  if (weightLabel) {
    const weight = Number(weightLabel[1].replace(',', '.')) * ({g:1, kg:1000, mg:0.001}[weightLabel[2].toLowerCase()]!) * amount;
    if (weight > 0 && Number.isFinite(weight) && (grams === undefined || Math.abs(weight - grams) <= Math.max(1e-8, grams * 1e-9))) return `${fmt(grams ?? weight, digits)} g`;
  }
  const label=`${fmt(amount,digits)} ${portionUnitLabel(amount,name)}`;
  return grams !== undefined && Number.isFinite(grams) ? `${label} · ${fmt(grams,digits)} g` : label;
}

export function entryQuantity(entry: {foodSnapshot: Food;amount?: number;unit?: Unit;grams: number},digits=3): string {
  if (entry.foodSnapshot.directNutrition) return portionQuantity(entry.foodSnapshot.directNutrition.amount, entry.foodSnapshot.directNutrition.unitLabel, entry.grams > 0 ? entry.grams : undefined, digits);
  if (entry.unit && entry.amount !== undefined) {
    if (entry.unit === 'portion') return portionQuantity(entry.amount,entry.foodSnapshot.portionName,entry.grams,digits);
    return `${fmt(entry.amount,digits)} ${unitLabels[entry.unit]}${entry.unit !== 'g' ? ` (${fmt(entry.grams,digits)} g)` : ''}`;
  }
  return `${fmt(entry.grams,digits)} g`;
}
