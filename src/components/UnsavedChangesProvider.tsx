import {createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, type ReactNode} from 'react';
import {DraftRegistry} from '../unsaved';
import {useToast} from './ToastProvider';
import {useRecovery} from './DraftRecoveryProvider';

const fallback = {registry: new DraftRegistry(), confirmNavigation: (_scopes?: string[]) => true};
const DraftContext = createContext(fallback);

export default function UnsavedChangesProvider({children}: {children: ReactNode}) {
  const registry = useRef(new DraftRegistry()).current;
  const notify = useToast();
  const confirmNavigation = useCallback((scopes?: string[]) => registry.canLeave(message => window.confirm(message),
    () => notify('Bitte warten, bis das Speichern abgeschlossen ist.', 'error'), scopes), [registry, notify]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!registry.pending().length) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [registry]);
  return <DraftContext.Provider value={{registry, confirmNavigation}}>{children}</DraftContext.Provider>;
}

export const useNavigationGuard = () => useContext(DraftContext).confirmNavigation;

export function useDraftGuard(label: string, value: unknown, busy: boolean, scope: string, explicitDirty?: boolean) {
  const {registry, confirmNavigation} = useContext(DraftContext);
  const recoveryContext = useRecovery();
  const recovery = recoveryContext?.recovery;
  const id = useId();
  const signature = JSON.stringify(value) ?? 'undefined';
  const baseline = useRef(recovery?.baseline(scope, signature) ?? signature);
  const latest = useRef(signature);
  latest.current = signature;
  const dirty = explicitDirty ?? signature !== baseline.current;
  useLayoutEffect(() => {
    registry.drafts.set(id, {label, scope, dirty, busy});
    recovery?.setGuard(id, {label, scope, dirty, baseline: baseline.current});recoveryContext?.schedule();
    return () => {registry.drafts.delete(id);recovery?.guards.delete(id);recoveryContext?.schedule();};
  }, [registry, id, label, scope, dirty, busy, recovery]);
  const markSaved = () => {
    baseline.current = latest.current;
    const draft = registry.drafts.get(id);
    if (draft) registry.drafts.set(id, {...draft, dirty: false, busy: false});
    if (recovery?.guards.has(id)) recovery.setGuard(id, {label, scope, dirty: false, baseline: baseline.current});
    recoveryContext?.schedule();
  };
  return {dirty, markSaved, confirmLeave: () => confirmNavigation([scope])};
}
