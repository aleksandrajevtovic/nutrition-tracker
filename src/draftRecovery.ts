export const draftRecoveryKey = 'nutrition-tracker:unsaved-draft:v1';
const maximumSize = 2_000_000;
export type RecoverySnapshot = {
  version: 1; owner: string; savedAt: string;
  values: Record<string, {value?: unknown}>;
  guards: Record<string, {label: string; baseline: string}>;
};
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readRecovery(storage: Storage): RecoverySnapshot | undefined {
  try {
    const text = storage.getItem(draftRecoveryKey);
    if (!text || text.length > maximumSize) return;
    const data = JSON.parse(text);
    if (data?.version !== 1 || typeof data.owner !== 'string' || !Number.isFinite(Date.parse(data.savedAt)) ||
      !data.values || Array.isArray(data.values) || typeof data.values !== 'object' ||
      !data.guards || Array.isArray(data.guards) || typeof data.guards !== 'object') return;
    const guards = Object.values(data.guards) as {label?: unknown; baseline?: unknown}[];
    if (!guards.length || !guards.every(guard => guard && typeof guard.label === 'string' && typeof guard.baseline === 'string') ||
      !Object.values(data.values).every(value => value && typeof value === 'object' && !Array.isArray(value))) return;
    return data;
  } catch {return;}
}

// Keep recovery separate from saved nutrition data and from the JSON backup.
export class DraftRecovery {
  readonly values = new Map<string, {value?: unknown}>();
  readonly guards = new Map<string, {scope: string; label: string; baseline: string; dirty: boolean}>();
  private recoveredValues = new Map<string, {value?: unknown}>();
  private recoveredGuards = new Map<string, {label: string; baseline: string}>();
  private written = false;
  constructor(private storage: Storage, private owner: string, private onError: () => void = () => {}) {}
  resume(snapshot: RecoverySnapshot) {
    this.recoveredValues = new Map(Object.entries(snapshot.values));
    this.recoveredGuards = new Map(Object.entries(snapshot.guards));
  }
  initial<T>(key: string, fallback: () => T): T {
    return this.recoveredValues.has(key) ? this.recoveredValues.get(key)!.value as T : fallback();
  }
  baseline(scope: string, fallback: string) {return this.recoveredGuards.get(scope)?.baseline ?? fallback;}
  setValue(key: string, value: unknown) {this.recoveredValues.delete(key);this.values.set(key, {value});}
  setGuard(id: string, guard: {scope: string; label: string; baseline: string; dirty: boolean}) {
    this.recoveredGuards.delete(guard.scope);this.guards.set(id, guard);
  }
  discard() {
    this.recoveredValues.clear();this.recoveredGuards.clear();this.guards.clear();
    try {this.storage.removeItem(draftRecoveryKey);} catch {this.onError();}
  }
  // Importing a backup invalidates drafts based on the previous dataset.
  invalidate() {this.discard();}
  flush() {
    try {
      const dirty = [...this.guards.values()].filter(guard => guard.dirty);
      if (!dirty.length && !this.recoveredGuards.size) {
        if (this.written && readRecovery(this.storage)?.owner === this.owner) this.storage.removeItem(draftRecoveryKey);
        return;
      }
      const snapshot: RecoverySnapshot = {version: 1, owner: this.owner, savedAt: new Date().toISOString(),
        values: Object.fromEntries([...this.recoveredValues, ...this.values]), guards: Object.fromEntries([
          ...this.recoveredGuards.entries(), ...dirty.map(guard => [guard.scope, {label: guard.label, baseline: guard.baseline}] as const),
        ]) as RecoverySnapshot['guards']};
      const text = JSON.stringify(snapshot);
      if (text.length > maximumSize) throw Error('Draft too large');
      this.storage.setItem(draftRecoveryKey, text);this.written = true;
    } catch {this.onError();}
  }
}
