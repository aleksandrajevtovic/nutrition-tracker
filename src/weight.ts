export type WeightRecord = {date: string; kg: number; updatedAt: string};
export type WeightRange = '30' | '90' | 'all';

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function validWeight(value: unknown): value is WeightRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<WeightRecord>;
  return validDate(record.date) && typeof record.kg === 'number' && Number.isFinite(record.kg)
    && record.kg > 0 && typeof record.updatedAt === 'string' && Number.isFinite(Date.parse(record.updatedAt));
}

export function parseWeight(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

export function weightHistory(records: WeightRecord[], date: string) {
  return records.filter(record => record.date <= date).sort((a, b) => a.date.localeCompare(b.date));
}

export function weightComparison(records: WeightRecord[], date: string) {
  const history = weightHistory(records, date);
  const latest = history.at(-1);
  const previous = history.at(-2);
  const first = history[0];
  return {
    latest, previous, first,
    previousChange: latest && previous ? Number((latest.kg - previous.kg).toFixed(3)) : undefined,
    totalChange: latest && history.length > 1 ? Number((latest.kg - first.kg).toFixed(3)) : undefined,
  };
}

export function weightsInRange(records: WeightRecord[], date: string, range: WeightRange) {
  const history = weightHistory(records, date);
  if (range === 'all') return history;
  const cutoff = new Date(`${date}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - Number(range) + 1);
  return history.filter(record => record.date >= cutoff.toISOString().slice(0, 10));
}

// Old backups predate weight tracking: leave current weights intact when restoring them.
export function backupWeights(backup: {version?: unknown; weights?: unknown}): WeightRecord[] | undefined {
  if (backup.version === 1) return undefined;
  if (!Array.isArray(backup.weights) || !backup.weights.every(validWeight)
    || new Set(backup.weights.map(record => record.date)).size !== backup.weights.length) {
    throw Error('Ungültige Gewichtsdaten');
  }
  return backup.weights;
}

export const weightDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
});
