export const validExportTime = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));

export const formatExportTime = (value: string) => new Date(value).toLocaleString('de-DE', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana',
});
