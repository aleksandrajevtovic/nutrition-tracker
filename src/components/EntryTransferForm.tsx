import {useDraftState} from './DraftRecoveryProvider';
import {useId, useRef, useState} from 'react';
import {ArrowRightLeft, Copy, X} from 'lucide-react';
import type {Entry} from '../db';
import {nextDate} from '../diary';
import {meals, today} from '../nutrition';
import {entryQuantity} from '../quantityLabels';
import {validDate, weightDate} from '../weight';
import type {EntryTransferMode, TransferEntry} from '../entryTransfer';
import {germanError} from '../german';
import {useDraftGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';
import {useToast} from './ToastProvider';
import './EntryTransferForm.css';

export default function EntryTransferForm({entry,mealOptions,onTransfer,onClose}: {
  entry: Entry;mealOptions: string[];onTransfer: TransferEntry;onClose: () => void;
}) {
  const id=useId();const notify=useToast();
  const [mode,setMode]=useDraftState<EntryTransferMode>(`EntryTransferForm:${entry.id}:mode`, 'copy');
  const [date,setDate]=useDraftState(`EntryTransferForm:${entry.id}:date`, ()=>nextDate(entry.date));
  const [meal,setMeal]=useDraftState(`EntryTransferForm:${entry.id}:meal`, entry.meal);
  const [busy,setBusy]=useState(false);
  const dateTouched=useRef(false),running=useRef(false);
  const guard=useDraftGuard('Eintrag kopieren oder verschieben',{mode,date,meal},busy,`entry-transfer:${entry.id}`);
  const form=useScrollReveal<HTMLFormElement>(true);
  const unchanged=mode==='move' && date===entry.date && meal===entry.meal;
  const valid=validDate(date) && Boolean(meal.trim()) && !unchanged;
  return <form ref={form} className="entry-transfer editor" aria-labelledby={`${id}-title`} onSubmit={async event=>{
    event.preventDefault();event.stopPropagation();if(running.current || !valid)return;
    running.current=true;setBusy(true);
    try{await onTransfer(entry,date,meal,mode);guard.markSaved();onClose();}
    catch(error){notify(germanError(error),'error');}
    finally{running.current=false;setBusy(false);}
  }}>
    <div className="section-head"><h3 id={`${id}-title`}>Eintrag kopieren oder verschieben</h3><button type="button" className="iconbtn" aria-label="Eintragsübertragung schließen" disabled={busy} onClick={()=>{if(guard.confirmLeave())onClose();}}><X size={17}/></button></div>
    <p className="hint">{entry.foodSnapshot.name} · {entryQuantity(entry)}<br/>{entry.meal} · {weightDate(entry.date)}</p>
    <div className="entry-transfer__modes" role="group" aria-label="Aktion für Eintrag">{(['copy','move'] as const).map(value=><button key={value} type="button" disabled={busy} aria-pressed={mode===value} onClick={()=>{setMode(value);if(!dateTouched.current)setDate(value==='copy' ? nextDate(entry.date) : entry.date);}}>{value==='copy' ? <Copy size={16}/> : <ArrowRightLeft size={16}/>} {value==='copy' ? 'Kopieren' : 'Verschieben'}</button>)}</div>
    <p className="hint">{mode==='copy' ? 'Der ursprüngliche Eintrag bleibt erhalten.' : 'Der Eintrag wird vom bisherigen Ort zum Ziel verschoben.'} Menge, Notiz und gespeicherte Nährwerte bleiben erhalten.</p>
    <div className="quantity-fields"><label>Zieldatum<input aria-label="Zieldatum für Eintrag" type="date" required disabled={busy} value={date} onChange={event=>{dateTouched.current=true;setDate(event.target.value);}}/></label>
      <label>Zielmahlzeit<select aria-label="Zielmahlzeit für Eintrag" disabled={busy} value={meal} onChange={event=>setMeal(event.target.value)}>{[...new Set([...meals,...mealOptions,entry.meal])].map(value=><option key={value}>{value}</option>)}</select></label></div>
    <div className="entry-transfer__dates" role="group" aria-label="Zieldatum schnell wählen"><button type="button" disabled={busy} onClick={()=>{dateTouched.current=true;setDate(entry.date);}}>Gleicher Tag</button><button type="button" disabled={busy} onClick={()=>{dateTouched.current=true;setDate(nextDate(today()));}}>Morgen</button></div>
    {unchanged && <p className="hint" role="status">Bitte ein anderes Datum oder eine andere Mahlzeit wählen.</p>}
    <button type="submit" className="primary wide" disabled={busy || !valid}>{mode==='copy' ? <Copy size={17}/> : <ArrowRightLeft size={17}/>} {busy ? 'Wird gespeichert…' : mode==='copy' ? 'Eintrag kopieren' : 'Eintrag verschieben'}</button>
  </form>;
}
