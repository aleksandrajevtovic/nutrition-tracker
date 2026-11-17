import {validDate} from './weight';

export function validCompletedDays(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(validDate) && new Set(value).size === value.length;
}

export function backupCompletedDays(backup: {completedDays?: unknown}): string[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(backup, 'completedDays')) return undefined;
  if (!validCompletedDays(backup.completedDays)) throw Error('Ungültige Angaben zu vollständig erfassten Tagen');
  return backup.completedDays;
}
