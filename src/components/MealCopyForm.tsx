import {useId, useRef, useState} from 'react';
import {Copy, X} from 'lucide-react';
import {meals} from '../nutrition';
import {nextDate} from '../diary';
import {validDate, weightDate} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';

export type CopyMeal = (sourceDate: string, sourceMeal: string, targetDate: string, targetMeal: string) => Promise<void>;

export default function MealCopyForm({date, meal, count, onCopy, onClose}: {
  date: string; meal: string; count: number; onCopy: CopyMeal; onClose: () => void;
}) {
  const id = useId();
  const [targetDate, setTargetDate] = useState(() => nextDate(date));
  const [targetMeal, setTargetMeal] = useState(meal);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const notify = useToast();
  const guard = useDraftGuard('Mahlzeit kopieren', {targetDate, targetMeal}, busy, 'meal-copy');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !validDate(targetDate)) return;
    submitting.current = true; setBusy(true);
    try {await onCopy(date, meal, targetDate, targetMeal); guard.markSaved(); onClose();}
    catch (error) {notify(germanError(error), 'error');}
    finally {submitting.current = false; setBusy(false);}
  }

  return <form className="meal-copy editor" onSubmit={submit} aria-labelledby={`${id}-title`}>
    <div className="section-head"><h3 id={`${id}-title`}>Mahlzeit kopieren</h3>
      <button type="button" className="iconbtn" aria-label="Kopieren abbrechen" disabled={busy} onClick={() => {if (guard.confirmLeave()) onClose();}}><X size={17}/></button></div>
    <p className="hint">{count} {count === 1 ? 'Eintrag' : 'Einträge'} aus „{meal}“ vom {weightDate(date)} übernehmen. Bestehende Einträge am Ziel bleiben erhalten.</p>
    <div className="quantity-fields"><label>Zieldatum<input type="date" required value={targetDate} disabled={busy} onChange={event => setTargetDate(event.target.value)}/></label>
      <label>Zielmahlzeit<select aria-label="Zielmahlzeit" value={targetMeal} disabled={busy} onChange={event => setTargetMeal(event.target.value)}>
        {Array.from(new Set([...meals, meal])).map(name => <option key={name}>{name}</option>)}
      </select></label></div>
    <button className="primary wide" disabled={busy || !validDate(targetDate)}><Copy size={17}/>{busy ? 'Wird kopiert…' : 'Mahlzeit kopieren'}</button>
  </form>;
}
