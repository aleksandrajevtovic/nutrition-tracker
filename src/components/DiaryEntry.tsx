import {useId, useState} from 'react';
import {ChevronDown, MessageSquare, Pencil, Trash2} from 'lucide-react';
import type {Entry} from '../db';
import {fmt, stats, unitLabels} from '../nutrition';
import QuickQuantity, {type SaveQuantity} from './QuickQuantity';
import './DiaryEntry.css';

export default function DiaryEntry({entry, compact, onEdit, onDelete, onQuantityChange}: {
  entry: Entry; compact: boolean; onEdit: (entry: Entry) => void; onDelete: (id: string) => Promise<void>; onQuantityChange: SaveQuantity;
}) {
  const [expanded, setExpanded] = useState(false);
  const [quantityEditing, setQuantityEditing] = useState(false);
  const detailsId = useId();
  const values = stats(entry.foodSnapshot, entry.grams);
  const quantity = entry.unit && entry.amount !== undefined
    ? `${fmt(entry.amount, 3)} ${entry.unit === 'portion' ? `× ${entry.foodSnapshot.portionName}` : unitLabels[entry.unit]}${entry.unit !== 'g' ? ` (${fmt(entry.grams, 3)} g)` : ''}`
    : `${fmt(entry.grams, 3)} g`;
  const actions = <div className="actions">
    <button type="button" title="Bearbeiten" aria-label={`${entry.foodSnapshot.name} bearbeiten`} onClick={() => onEdit(entry)}><Pencil size={16}/></button>
    <button type="button" title="Löschen" aria-label={`${entry.foodSnapshot.name} löschen`} onClick={() => void onDelete(entry.id)}><Trash2 size={16}/></button>
  </div>;

  if (!compact) return <div className="entry"><div><strong>{entry.foodSnapshot.name}</strong>
    <button type="button" className="diary-entry__quantity-toggle" aria-label={`Menge für ${entry.foodSnapshot.name} ändern`} aria-expanded={quantityEditing} aria-controls={detailsId} onClick={() => setQuantityEditing(value => !value)}>
      <small>{quantity} · {Math.round(values.kcal)} kcal · P {fmt(values.protein)} g</small><span><Pencil size={11} aria-hidden="true"/>Menge ändern</span></button>
    <div id={detailsId} hidden={!quantityEditing}>{quantityEditing && <QuickQuantity entry={entry} onSave={onQuantityChange}/>}</div>
    {entry.note?.trim() && <p className="diary-entry__note"><span>Notiz</span>{entry.note}</p>}</div>{actions}</div>;

  return <div className="entry diary-entry--compact">
    <button type="button" className="diary-entry__toggle" aria-label={`${entry.foodSnapshot.name}: Details ${expanded ? 'einklappen' : 'aufklappen'}`}
      aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>
      <span className="diary-entry__name" title={entry.foodSnapshot.name}>{entry.foodSnapshot.name}</span>
      <span className="diary-entry__calories">{Math.round(values.kcal)} <span>kcal</span></span>
      {entry.note?.trim() && <MessageSquare size={14} role="img" aria-label="Notiz vorhanden" className="diary-entry__note-icon"/>}
      <ChevronDown size={16} aria-hidden="true"/>
    </button>
    <div id={detailsId} className="diary-entry__details" hidden={!expanded}>
      <strong>{entry.foodSnapshot.name}</strong>
      {entry.foodSnapshot.brand && <small>{entry.foodSnapshot.brand}</small>}
      <p className="diary-entry__quantity">{quantity}</p>
      <QuickQuantity entry={entry} onSave={onQuantityChange}/>
      <dl className="diary-entry__nutrients">
        {[
          ['Protein', values.protein], ['Kohlenhydrate', values.carbs], ['Fett', values.fat],
          ['Ballaststoffe', values.fiber], ['Zucker', entry.foodSnapshot.sugar * entry.grams / 100],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{fmt(Number(value))} g</dd></div>)}
      </dl>
      {entry.note?.trim() && <p className="diary-entry__note"><span>Notiz</span>{entry.note}</p>}
      {actions}
    </div>
  </div>;
}
