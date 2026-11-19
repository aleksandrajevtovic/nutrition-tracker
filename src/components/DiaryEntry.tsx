import {useDraftState} from './DraftRecoveryProvider';
import {useId, useRef, useState} from 'react';
import {ChevronDown, MessageSquare, Pencil} from 'lucide-react';
import type {Entry} from '../db';
import {fmt, stats, nutrientAmount} from '../nutrition';
import {entryQuantity} from '../quantityLabels';
import QuickQuantity, {type SaveQuantity} from './QuickQuantity';
import {useNavigationGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';
import './DiaryEntry.css';
import EntryTransferForm from './EntryTransferForm';
import {nutrientMissing} from '../nutrientCoverage';
import type {TransferEntry} from '../entryTransfer';
import EntryActions from './EntryActions';

export default function DiaryEntry({entry, compact, onEdit, onDelete, onQuantityChange, onTransfer, mealOptions, transferring, onOpenTransfer, onCloseTransfer}: {
  entry: Entry; compact: boolean; onEdit: (entry: Entry) => void; onDelete: (id: string) => Promise<void>; onQuantityChange: SaveQuantity;
  onTransfer: TransferEntry;mealOptions: string[];
  transferring: boolean;onOpenTransfer: (entry: Entry) => boolean;onCloseTransfer: () => void;
}) {
  const [expanded, setExpanded] = useDraftState(`DiaryEntry:${entry.id}:expanded`, false);
  const [quantityEditing, setQuantityEditing] = useDraftState(`DiaryEntry:${entry.id}:quantityEditing`, false);
  const [quantitySession,setQuantitySession]=useState(0);
  const transferButton=useRef<HTMLButtonElement>(null);
  const transferId=useId();
  const entryRef = useScrollReveal<HTMLDivElement>(compact ? expanded : quantityEditing);
  const confirmNavigation = useNavigationGuard();
  const detailsId = useId();
  const values = stats(entry.foodSnapshot, entry.grams);
  const quantity = entryQuantity(entry);
  const estimated = entry.foodSnapshot.directNutrition?.estimated ? <small className="entry-estimate">Geschätzte Werte</small> : null;
  const missing = entry.foodSnapshot.directNutrition?.missing ?? [];
  const closeTransfer=()=>{onCloseTransfer();transferButton.current?.focus({preventScroll:true});};
  const transfer=<div id={transferId} className="diary-entry__transfer" hidden={!transferring}>{transferring && <EntryTransferForm entry={entry} mealOptions={mealOptions} onTransfer={onTransfer} onClose={closeTransfer}/>}</div>;
  const actions = <EntryActions name={entry.foodSnapshot.name} buttonRef={transferButton} transferring={transferring} visible={!compact || expanded} onEdit={() => onEdit(entry)} onTransfer={()=>{
      if(transferring){if(confirmNavigation([`entry-transfer:${entry.id}`]))closeTransfer();return;}
      if(!onOpenTransfer(entry))return;
      setQuantityEditing(false);setQuantitySession(value=>value+1);
    }} onDelete={() => {if (confirmNavigation([`quantity:${entry.id}`])) void onDelete(entry.id);}}/>;

  if (!compact) return <div ref={entryRef} className="entry diary-entry--full"><div className="diary-entry__main"><strong>{entry.foodSnapshot.name}</strong>
    {estimated}
    <button type="button" disabled={transferring} className="diary-entry__quantity-toggle" aria-label={`Menge für ${entry.foodSnapshot.name} ändern`} aria-expanded={quantityEditing} aria-controls={detailsId} onClick={() => {if (!quantityEditing || confirmNavigation([`quantity:${entry.id}`])) setQuantityEditing(value => !value);}}>
      <small>{quantity} · {Math.round(values.kcal)} kcal{missing.includes('protein') ? '' : ` · Eiweiß ${fmt(values.protein)} g`}</small><span><Pencil size={11} aria-hidden="true"/>Menge ändern</span></button>
    <div id={detailsId} hidden={!quantityEditing}>{quantityEditing && <QuickQuantity key={quantitySession} entry={entry} onSave={onQuantityChange}/>}</div>
    {entry.note?.trim() && <p className="diary-entry__note"><span>Notiz</span>{entry.note}</p>}</div>{actions}{transfer}</div>;

  return <div ref={entryRef} className="entry diary-entry--compact">
    <button type="button" className="diary-entry__toggle" aria-label={`${entry.foodSnapshot.name}: Details ${expanded ? 'einklappen' : 'aufklappen'}`}
      aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>
      <span className="diary-entry__name" title={entry.foodSnapshot.name}>{entry.foodSnapshot.name}{estimated}</span>
      <span className="diary-entry__calories">{Math.round(values.kcal)} <span>kcal</span></span>
      {entry.note?.trim() && <MessageSquare size={14} role="img" aria-label="Notiz vorhanden" className="diary-entry__note-icon"/>}
      <ChevronDown size={16} aria-hidden="true"/>
    </button>
    <div id={detailsId} className="diary-entry__details" hidden={!expanded}>
      <strong>{entry.foodSnapshot.name}</strong>
      {entry.foodSnapshot.brand && <small>{entry.foodSnapshot.brand}</small>}
      <p className="diary-entry__quantity">{quantity}</p>
      <div hidden={transferring}><QuickQuantity key={quantitySession} entry={entry} onSave={onQuantityChange}/></div>
      <dl className="diary-entry__nutrients">
        {[
          ['Eiweiß', values.protein, 'protein'], ['Kohlenhydrate', values.carbs, 'carbs'], ['Fett', values.fat, 'fat'],
          ['Ballaststoffe', values.fiber, 'fiber'], ['Zucker', nutrientAmount(entry.foodSnapshot, entry.grams, 'sugar'), 'sugar'],
        ].map(([label, value, key]) => <div key={label}><dt>{label}</dt><dd>{nutrientMissing(entry.foodSnapshot, key as 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar') ? 'Nicht angegeben' : `${fmt(Number(value))} g`}</dd></div>)}
      </dl>
      {entry.note?.trim() && <p className="diary-entry__note"><span>Notiz</span>{entry.note}</p>}
      {actions}
      {transfer}
    </div>
  </div>;
}
