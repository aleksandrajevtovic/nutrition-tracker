import {useDraftState} from './DraftRecoveryProvider';
import {useId, useRef, useState} from 'react';
import {Copy, X} from 'lucide-react';
import {meals} from '../nutrition';
import {nextDate} from '../diary';
import {validDate, weightDate} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';
import type {Entry} from '../db';
import {mealCopyAmount, type MealCopySelection} from '../mealCopy';
import {parseWeight} from '../weight';
import MealCopyItem, {type MealCopyChoice} from './MealCopyItem';
import './MealCopyForm.css';

export type CopyMeal = (sourceDate: string, sourceMeal: string, targetDate: string, targetMeal: string, selection?: MealCopySelection[]) => Promise<void>;

export default function MealCopyForm({date, meal, entries, onCopy, onClose}: {
  date: string; meal: string; entries: Entry[]; onCopy: CopyMeal; onClose: () => void;
}) {
  const id = useId();
  const [targetDate, setTargetDate] = useDraftState('MealCopyForm:targetDate', () => nextDate(date));
  const [targetMeal, setTargetMeal] = useDraftState('MealCopyForm:targetMeal', meal);
  const [choices, setChoices] = useDraftState<MealCopyChoice[]>('MealCopyForm:choices', () => entries.map(source => ({source:structuredClone(source), checked:true, amount:String(source.amount ?? source.grams).replace('.', ',')})));
  const selected = choices.filter(choice => choice.checked);
  const valid = selected.length > 0 && selected.every(choice => {try {mealCopyAmount(choice.source, parseWeight(choice.amount));return true;} catch {return false;}});
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const notify = useToast();
  const formRef = useScrollReveal<HTMLFormElement>(true);
  const guard = useDraftGuard('Mahlzeit kopieren', {targetDate, targetMeal, choices}, busy, 'meal-copy');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!validDate(targetDate) || !valid) {notify('Bitte mindestens ein Lebensmittel auswählen und gültige Mengen sowie ein Zieldatum eingeben.', 'error');return;}
    submitting.current = true; setBusy(true);
    try {await onCopy(date, meal, targetDate, targetMeal, selected.map(choice => ({source:choice.source, amount:parseWeight(choice.amount)}))); guard.markSaved(); onClose();}
    catch (error) {notify(germanError(error), 'error');}
    finally {submitting.current = false; setBusy(false);}
  }

  return <form ref={formRef} className="meal-copy editor" onSubmit={submit} aria-labelledby={`${id}-title`}>
    <div className="section-head"><h3 id={`${id}-title`}>Mahlzeit kopieren</h3>
      <button type="button" className="iconbtn" aria-label="Kopieren abbrechen" disabled={busy} onClick={() => {if (guard.confirmLeave()) onClose();}}><X size={17}/></button></div>
    <p className="hint">Lebensmittel aus „{meal}“ vom {weightDate(date)} auswählen und Mengen für die Kopie anpassen. Notizen und gespeicherte Nährwerte werden übernommen. Original und bestehende Einträge am Ziel bleiben erhalten.</p>
    <div className="quantity-fields"><label>Zieldatum<input type="date" required value={targetDate} disabled={busy} onChange={event => setTargetDate(event.target.value)}/></label>
      <label>Zielmahlzeit<select aria-label="Zielmahlzeit" value={targetMeal} disabled={busy} onChange={event => setTargetMeal(event.target.value)}>
        {Array.from(new Set([...meals, meal])).map(name => <option key={name}>{name}</option>)}
      </select></label></div>
    <div className="meal-copy__selection-actions"><button type="button" className="secondary" disabled={busy || selected.length === choices.length} onClick={() => setChoices(current => current.map(choice => ({...choice, checked:true})))}>Alle auswählen</button>
      <button type="button" className="secondary" disabled={busy || !selected.length} onClick={() => setChoices(current => current.map(choice => ({...choice, checked:false})))}>Keine auswählen</button></div>
    <p className="hint" role="status">{selected.length} von {choices.length} {choices.length === 1 ? 'Eintrag ausgewählt' : 'Einträgen ausgewählt'}.</p>
    <ul className="meal-copy__items">{choices.map((choice, index) => <MealCopyItem key={choice.source.id} choice={choice} index={index} busy={busy} onChange={value => setChoices(current => current.map(row => row.source.id === value.source.id ? value : row))}/>)}</ul>
    <button className="primary wide" disabled={busy || !validDate(targetDate) || !valid}><Copy size={17}/>{busy ? 'Wird kopiert…' : 'Mahlzeit kopieren'}</button>
  </form>;
}
