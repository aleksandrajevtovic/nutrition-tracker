import type {Entry} from './db';

export const entrySignature = (entry: Entry) => JSON.stringify(entry, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
