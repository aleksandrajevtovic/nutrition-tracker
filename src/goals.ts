export const goalFields = [
  {key: 'kcal', label: 'Kalorien', unit: 'kcal'},
  {key: 'protein', label: 'Protein', unit: 'g'},
  {key: 'carbs', label: 'Kohlenhydrate', unit: 'g'},
  {key: 'fat', label: 'Fett', unit: 'g'},
  {key: 'fiber', label: 'Ballaststoffe', unit: 'g'},
] as const;
export type GoalKey = typeof goalFields[number]['key'];
export type DailyGoals = Partial<Record<GoalKey, number>>;

export function validGoals(value: unknown): value is DailyGoals {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, target]) => goalFields.some(field => field.key === key)
      && typeof target === 'number' && Number.isFinite(target) && target > 0));
}

export function parseGoals(values: Record<GoalKey, string>): DailyGoals {
  const goals: DailyGoals = {};
  for (const {key} of goalFields) {
    const text = values[key].trim().replace(',', '.');
    if (!text) continue;
    if (!/^\d+(?:\.\d+)?$/.test(text)) throw Error('Bitte für Tagesziele positive Zahlen eingeben oder das Feld leer lassen.');
    goals[key] = Number(text);
  }
  if (!validGoals(goals)) throw Error('Bitte für Tagesziele positive Zahlen eingeben oder das Feld leer lassen.');
  return goals;
}

export function goalProgress(current: number, target: number) {
  const percent = current / target * 100;
  const difference = Number((target - current).toFixed(6)) || 0;
  return {percent: Math.round(percent), barPercent: Math.max(0, Math.min(100, percent)), difference};
}

export function backupGoals(backup: {version?: unknown; goals?: unknown}): DailyGoals | undefined {
  if (backup.version === 1 || backup.version === 2) return undefined;
  if (!validGoals(backup.goals)) throw Error('Ungültige Tagesziele');
  return backup.goals;
}
