import {useId, useRef, useState} from 'react';
import {Check, X} from 'lucide-react';
import {goalFields, parseGoals, type DailyGoals, type GoalKey} from '../goals';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';

export default function GoalEditor({goals, onSave, onClose}: {
  goals: DailyGoals; onSave: (goals: DailyGoals) => Promise<void>; onClose: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState(() => Object.fromEntries(goalFields.map(({key}) => [key, goals[key] === undefined ? '' : String(goals[key]).replace('.', ',')])) as Record<GoalKey, string>);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const notify = useToast();
  const guard = useDraftGuard('Tagesziele', values, busy, 'goals');

  async function persist(next: () => DailyGoals) {
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {await onSave(next()); guard.markSaved(); onClose();} catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }

  return <form className="goal-editor" aria-labelledby={`${id}-title`} onSubmit={event => {event.preventDefault(); void persist(() => parseGoals(values));}}>
    <div className="goal-editor__heading"><h3 id={`${id}-title`}>Eigene Tagesziele</h3>
      <button className="iconbtn" type="button" disabled={busy} aria-label="Tagesziele schließen" onClick={() => {if (guard.confirmLeave()) onClose();}}><X size={17}/></button></div>
    <p className="hint">Lege deine eigenen Werte fest. Leere Felder blenden das jeweilige Ziel aus. Die Ziele gelten für alle Tage, auch in älteren Tagesansichten.</p>
    <div className="goal-editor__fields">{goalFields.map(({key, label, unit}) => <label key={key} htmlFor={`${id}-${key}`}>
      {label} ({unit})<input id={`${id}-${key}`} type="text" inputMode="decimal" autoComplete="off" placeholder="Kein Ziel" disabled={busy}
        value={values[key]} onChange={event => setValues({...values, [key]: event.target.value})}/>
    </label>)}</div>
    <div className="goal-editor__actions"><button className="primary" disabled={busy}><Check size={17}/>{busy ? 'Wird gespeichert…' : 'Tagesziele speichern'}</button>
      {Object.keys(goals).length > 0 && <button className="secondary" type="button" disabled={busy} onClick={() => void persist(() => ({}))}>Alle Ziele entfernen</button>}
    </div>
  </form>;
}
