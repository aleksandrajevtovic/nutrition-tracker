import {useEffect, useId, useRef, useState} from 'react';
import {Check, Trash2, X} from 'lucide-react';
import {fmt} from '../nutrition';
import {parseWeight, weightDate, type WeightRecord} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';

export default function WeightEntryForm({date, record, suggestion, onSave, onRemove, onClose}: {
  date: string; record?: WeightRecord; suggestion?: WeightRecord;
  onSave: (date: string, kg: number) => Promise<void>; onRemove: (date: string) => Promise<void>; onClose: () => void;
}) {
  const initial = record ?? suggestion;
  const [value, setValue] = useState(initial ? String(initial.kg).replace('.', ',') : '');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const notify = useToast();
  const parsed = parseWeight(value);
  const guard = useDraftGuard('Gewichtseintrag', Number.isFinite(parsed) ? parsed : value, busy, 'weight');
  useEffect(() => {
    input.current?.scrollIntoView({block: 'nearest'});
    input.current?.focus({preventScroll: true}); input.current?.select();
  }, []);

  async function run(action: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {await action(); guard.markSaved(); onClose();}
    catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }

  return <form className="weight-form weight-entry-form" onSubmit={event => {
    event.preventDefault();
    if (!Number.isFinite(parsed) || parsed <= 0) {notify('Bitte ein gültiges Gewicht über 0 kg eingeben.', 'error'); return;}
    void run(() => onSave(date, parsed));
  }}>
    <div className="weight-entry-form__heading"><h3>{record ? 'Gewicht bearbeiten' : 'Gewicht eintragen'}</h3>
      <button type="button" className="iconbtn" aria-label="Gewichtseingabe schließen" disabled={busy} onClick={() => {if (guard.confirmLeave()) onClose();}}><X size={17}/></button></div>
    <label htmlFor={`${id}-weight`}>Gewicht am {weightDate(date)}</label>
    <div className="weight-form__fields"><div className="weight-form__input">
      <input ref={input} id={`${id}-weight`} type="text" inputMode="decimal" autoComplete="off" required placeholder="z. B. 72,5"
        value={value} disabled={busy} onChange={event => setValue(event.target.value)} aria-describedby={`${id}-unit ${id}-hint`}/>
      <span id={`${id}-unit`}>kg</span>
    </div>
      <button className="primary" disabled={busy}><Check size={17}/>{busy ? 'Wird gespeichert…' : record ? 'Aktualisieren' : 'Speichern'}</button>
      {record && <button type="button" className="weight-form__delete" aria-label="Gewichtseintrag löschen" title="Gewichtseintrag löschen" disabled={busy} onClick={() => {
        if (!confirm(`Gewichtseintrag vom ${weightDate(date)} löschen?`)) return;
        void run(() => onRemove(date));
      }}><Trash2 size={17}/></button>}
    </div>
    <p className="hint" id={`${id}-hint`}>{!record && suggestion
      ? `Vorschlag: ${fmt(suggestion.kg, 3)} kg von der Messung am ${weightDate(suggestion.date)}. Erst „Speichern“ trägt den Wert für diesen Tag ein.`
      : 'Ein Wert pro Tag. Gespeichert wird für das oben angezeigte Datum.'}</p>
  </form>;
}
