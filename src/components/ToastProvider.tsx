import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {CheckCircle2, CircleAlert, X} from 'lucide-react';
import {germanError} from '../german';
import './Toast.css';

type ToastType = 'success' | 'error';
type ToastAction = {label: string; onClick: () => void | Promise<void>};
type Toast = {id: string; message: string; type: ToastType; action?: ToastAction};
type Notify = (message: string, type: ToastType, action?: ToastAction) => void;
const ToastContext = createContext<Notify | null>(null);

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('Benachrichtigungen sind nicht verfügbar.');
  return notify;
}

function ToastItem({toast, onDismiss}: {toast: Toast; onDismiss: (id: string) => void}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const notify = useToast();
  const paused = hovered || focused || busy;
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.action ? 10000 : toast.type === 'error' ? 8000 : 4500);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.type, toast.action, onDismiss, paused]);

  async function runAction() {
    if (!toast.action || running.current) return;
    running.current = true; setBusy(true);
    try {await toast.action.onClick(); onDismiss(toast.id);}
    catch (error) {notify(germanError(error), 'error');}
    finally {running.current = false; setBusy(false);}
  }

  const Icon = toast.type === 'error' ? CircleAlert : CheckCircle2;
  return <div className={`toast toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-atomic="true"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={e => {
      if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
    }}>
    <Icon size={21} aria-hidden="true"/>
    <div className="toast__content"><strong>{toast.type === 'error' ? 'Fehler' : 'Erfolgreich'}</strong><p>{toast.message}</p>
      {toast.action && <button type="button" className="toast__action" disabled={busy} onClick={runAction}>{busy ? 'Bitte warten…' : toast.action.label}</button>}
    </div>
    <button type="button" disabled={busy} aria-label="Benachrichtigung schließen" onClick={() => onDismiss(toast.id)}><X size={17}/></button>
  </div>;
}

export default function ToastProvider({children}: {children: ReactNode}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback<Notify>((message, type, action) => {
    const toast = {id: crypto.randomUUID(), message, type, action};
    setToasts(current => [...current.slice(-4), toast]);
  }, []);
  const dismiss = useCallback((id: string) => setToasts(current => current.filter(toast => toast.id !== id)), []);

  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toast-stack" role="region" aria-label="Benachrichtigungen">
      {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss}/>)}
    </div>
  </ToastContext.Provider>;
}
