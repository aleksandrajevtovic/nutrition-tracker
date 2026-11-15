import {useEffect, useRef, useState} from 'react';
import {Check} from 'lucide-react';
import type {Entry} from '../db';
import {fmt, stats, toGrams, unitLabels} from '../nutrition';
import {parseWeight} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import './QuickQuantity.css';

export type SaveQuantity = (id: string, amount: number) => Promise<Entry>;

export default function QuickQuantity({entry, onSave}: {entry: Entry; onSave: SaveQuantity}) {
  const current = entry.amount ?? entry.grams;
  const [value, setValue] = useState(String(current).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const notify = useToast();
  const amount = parseWeight(value);
  const unit = entry.unit ?? 'g';
  const grams = toGrams(entry.foodSnapshot, amount, unit);
  const valid = Number.isFinite(amount) && amount > 0 && Number.isFinite(grams) && grams > 0 && Number.isFinite(stats(entry.foodSnapshot, grams).kcal);
  useEffect(() => {setValue(String(current).replace('.', ','));}, [entry.id, current]);

  return <form className="quick-quantity" onSubmit={async event => {
    event.preventDefault();
    if (saving.current) return;
    if (!valid) {notify('Bitte eine gültige Menge über 0 eingeben.', 'error'); return;}
    saving.current = true; setBusy(true);
    try {await onSave(entry.id, amount);} catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }}>
    <label>Menge direkt ändern<span className="quick-quantity__fields"><input aria-label={`Menge für ${entry.foodSnapshot.name}`} type="text" inputMode="decimal" value={value} disabled={busy} onChange={event => setValue(event.target.value)}/>
      <span className="quick-quantity__unit">{unit === 'portion' ? `× ${entry.foodSnapshot.portionName}` : unitLabels[unit]}</span></span></label>
    <p className="hint" aria-live="polite">{valid ? `${fmt(grams, 3)} g · ${Math.round(stats(entry.foodSnapshot, grams).kcal)} kcal` : 'Bitte eine gültige Menge über 0 eingeben.'}</p>
    <button type="submit" className="secondary" disabled={busy || !valid || amount === current}><Check size={16}/>{busy ? 'Wird gespeichert…' : 'Menge speichern'}</button>
  </form>;
}
