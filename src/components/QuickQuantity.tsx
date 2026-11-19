import {useDraftState} from './DraftRecoveryProvider';
import {useEffect, useRef, useState} from 'react';
import {Check} from 'lucide-react';
import type {Entry} from '../db';
import {stats, unitLabels} from '../nutrition';
import {parseWeight} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';
import {entryQuantity, portionUnitLabel} from '../quantityLabels';
import {withEntryAmount} from '../entryQuantity';
import './QuickQuantity.css';

export type SaveQuantity = (id: string, amount: number) => Promise<Entry>;

export default function QuickQuantity({entry, onSave}: {entry: Entry; onSave: SaveQuantity}) {
  const current = entry.amount ?? entry.grams;
  const [value, setValue] = useDraftState(`QuickQuantity:${entry.id}:value`, String(current).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const notify = useToast();
  const amount = parseWeight(value);
  const guard = useDraftGuard(`Menge: ${entry.foodSnapshot.name}`, value, busy, `quantity:${entry.id}`, Number.isFinite(amount) ? amount !== current : value !== String(current).replace('.', ','));
  const unit = entry.unit ?? 'g';
  let preview: Entry | undefined;
  try {preview = withEntryAmount(entry, amount);} catch {}
  const valid = Boolean(preview);
  const previous = useRef({id: entry.id, amount: current});
  useEffect(() => {
    if (previous.current.id !== entry.id || previous.current.amount !== current) setValue(String(current).replace('.', ','));
    previous.current = {id: entry.id, amount: current};
  }, [entry.id, current]);

  return <form className="quick-quantity" onSubmit={async event => {
    event.preventDefault();
    if (saving.current) return;
    if (!valid) {notify('Bitte eine gültige Menge über 0 eingeben.', 'error'); return;}
    saving.current = true; setBusy(true);
    try {await onSave(entry.id, amount); guard.markSaved();} catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }}>
    <label>Menge direkt ändern<span className="quick-quantity__fields"><input aria-label={`Menge für ${entry.foodSnapshot.name}`} type="text" inputMode="decimal" value={value} disabled={busy} onChange={event => setValue(event.target.value)}/>
      <span className="quick-quantity__unit">{unit === 'portion' ? portionUnitLabel(amount,entry.foodSnapshot.portionName) : unitLabels[unit]}</span></span></label>
    <p className="hint" aria-live="polite">{preview ? `${entryQuantity(preview)} · ${Math.round(stats(preview.foodSnapshot, preview.grams).kcal)} kcal` : 'Bitte eine gültige Menge über 0 eingeben.'}</p>
    <button type="submit" className="secondary" disabled={busy || !valid || amount === current}><Check size={16}/>{busy ? 'Wird gespeichert…' : 'Menge speichern'}</button>
  </form>;
}
