import {validDate} from './weight';

export const noteFields = ['hunger', 'energy', 'training', 'observations'] as const;
export type NoteValues = Record<typeof noteFields[number], string>;
export type DailyNote = NoteValues & {date: string; updatedAt: string};
export const emptyNoteValues = (): NoteValues => ({hunger: '', energy: '', training: '', observations: ''});
export const hasNoteContent = (values: NoteValues) => noteFields.some(key => values[key].trim().length > 0);

export function validNote(value: unknown): value is DailyNote {
  const note = value as DailyNote;
  return Boolean(note && validDate(note.date) && typeof note.updatedAt === 'string' && Number.isFinite(Date.parse(note.updatedAt))
    && noteFields.every(key => typeof note[key] === 'string') && hasNoteContent(note));
}
export function createDayNote(date: string, values: NoteValues): DailyNote | null {
  if (!validDate(date) || !values || !noteFields.every(key => typeof values[key] === 'string')) throw Error('Ungültige Tagesnotiz');
  const trimmed = Object.fromEntries(noteFields.map(key => [key, values[key].trim()])) as NoteValues;
  return hasNoteContent(trimmed) ? {...trimmed, date, updatedAt: new Date().toISOString()} : null;
}
export function backupNotes(backup: {version?: unknown; dailyNotes?: unknown}): DailyNote[] | undefined {
  if (backup.version !== 5 && backup.version !== 6) return undefined;
  if (!Array.isArray(backup.dailyNotes) || !backup.dailyNotes.every(validNote)
    || new Set(backup.dailyNotes.map(note => note.date)).size !== backup.dailyNotes.length) throw Error('Ungültige Tagesnotizen');
  return backup.dailyNotes;
}
