export type DraftState = {label: string; scope: string; dirty: boolean; busy: boolean};

export class DraftRegistry {
  readonly drafts = new Map<string, DraftState>();
  pending(scopes?: string[]) {
    return [...this.drafts.values()].filter(draft => (!scopes || scopes.some(scope => scope.endsWith(':') ? draft.scope.startsWith(scope) : draft.scope === scope)) && (draft.dirty || draft.busy));
  }
  canLeave(confirmDiscard: (message: string) => boolean, onBusy: () => void, scopes?: string[]) {
    const pending = this.pending(scopes);
    if (pending.some(draft => draft.busy)) {onBusy(); return false;}
    if (!pending.length) return true;
    const labels = [...new Set(pending.map(draft => draft.label))].join(', ');
    return confirmDiscard(`Ungespeicherte Änderungen: ${labels}.\n\nÄnderungen verwerfen und fortfahren? Mit „Abbrechen“ bleiben deine Eingaben erhalten.`);
  }
}
