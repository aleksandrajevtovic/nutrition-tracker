import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction, type ReactNode} from 'react';
import {DraftRecovery, readRecovery} from '../draftRecovery';
import {useToast} from './ToastProvider';
import './DraftRecovery.css';

const Context = createContext<{recovery: DraftRecovery; schedule: () => void} | null>(null);
export const useRecovery = () => useContext(Context);

export default function DraftRecoveryProvider({children}: {children: ReactNode}) {
  const notify = useToast();
  const [pending, setPending] = useState(() => {try {return readRecovery(localStorage);} catch {return;}});
  const [recovery] = useState(() => {
    let warned = false;
    const storage = {getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value), removeItem: (key: string) => localStorage.removeItem(key)};
    return new DraftRecovery(storage, crypto.randomUUID(), () => {
      if (!warned) {warned = true;notify('Der Entwurf konnte nicht auf diesem Gerät gesichert werden. Bitte vor dem Neuladen speichern.', 'error');}
    });
  });
  const queued = useRef(false);
  const schedule = () => {
    if (queued.current) return;
    queued.current = true;queueMicrotask(() => {queued.current = false;recovery.flush();});
  };
  useEffect(() => {
    const flush = () => recovery.flush();
    const imported = () => recovery.invalidate();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);window.addEventListener('beforeunload', flush);
    window.addEventListener('nutrition-backup-restored', imported);
    return () => {document.removeEventListener('visibilitychange', flush);window.removeEventListener('pagehide', flush);window.removeEventListener('beforeunload', flush);window.removeEventListener('nutrition-backup-restored', imported);};
  }, [recovery]);
  const resume = useRef<HTMLButtonElement>(null);
  useEffect(() => {if (pending) resume.current?.focus();}, [pending]);
  return <Context.Provider value={{recovery, schedule}}>{pending ? <main className="draft-recovery-screen"><section className="panel draft-recovery" aria-labelledby="draft-recovery-title">
    <span className="eyebrow">UNGESPEICHERTE EINGABEN</span><h1 id="draft-recovery-title">Dein Entwurf ist noch da</h1>
    <p>{[...new Set(Object.values(pending.guards).map(guard => guard.label))].join(', ')}</p>
    <p className="hint">Möchtest du deine Eingaben fortsetzen? Du kannst sie prüfen und anschließend speichern. Gespeicherte Einträge bleiben erhalten.</p>
    <div className="draft-recovery__actions"><button ref={resume} type="button" className="primary" onClick={() => {recovery.resume(pending);setPending(undefined);}}>Entwurf fortsetzen</button>
      <button type="button" className="secondary" onClick={() => {recovery.discard();setPending(undefined);}}>Verwerfen</button></div>
  </section></main> : children}</Context.Provider>;
}

export function useDraftState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
export function useDraftState<T = undefined>(key: string): [T | undefined, Dispatch<SetStateAction<T | undefined>>];
export function useDraftState<T>(key: string, initial?: T | (() => T)) {
  const context = useRecovery();
  const [value, setValue] = useState(() => {
    const fallback = () => typeof initial === 'function' ? (initial as () => T)() : initial;
    return context ? context.recovery.initial(key, fallback) : fallback();
  });
  const recovery = context?.recovery;
  useLayoutEffect(() => {
    if (!recovery) return;
    recovery.setValue(key, value);context.schedule();
    return () => {recovery.values.delete(key);context.schedule();};
  }, [key, value, recovery]);
  return [value, setValue] as const;
}
