import type {Entry} from '../db';
import {mealCopyAmount} from '../mealCopy';
import {parseWeight} from '../weight';
import {unitLabels} from '../nutrition';
import {entryQuantity, portionNameLabel} from '../quantityLabels';

export type MealCopyChoice = {source: Entry; checked: boolean; amount: string};

export default function MealCopyItem({choice, index, busy, onChange}: {choice: MealCopyChoice; index: number; busy: boolean; onChange: (choice: MealCopyChoice) => void}) {
  const {source, checked, amount} = choice;
  let preview: Entry | undefined;
  try {preview = mealCopyAmount(source, parseWeight(amount));} catch {}
  const unit = source.unit ?? 'g';
  return <li className={`meal-copy-item${checked ? '' : ' meal-copy-item--unchecked'}`}>
    <label className="meal-copy-item__select"><input type="checkbox" aria-label={`Eintrag ${index+1}: ${source.foodSnapshot.name} kopieren`} checked={checked} disabled={busy} onChange={event => onChange({...choice, checked:event.target.checked})}/>
      <span><strong>{source.foodSnapshot.name}</strong><small>Original: {entryQuantity(source)}</small></span></label>
    <label className="meal-copy-item__amount">Menge<span className="meal-copy-item__quantity"><input type="text" inputMode="decimal" autoComplete="off" aria-label={`Menge für ${source.foodSnapshot.name}, Eintrag ${index+1}`} aria-invalid={checked && !preview || undefined} value={amount} disabled={busy || !checked} onFocus={event => event.currentTarget.select()} onChange={event => onChange({...choice, amount:event.target.value})}/>
      <span>{unit === 'portion' ? portionNameLabel(source.foodSnapshot.portionName) : unitLabels[unit]}</span></span></label>
    {checked && <p className={preview ? 'hint' : 'meal-copy-item__error'}>{preview ? `Kopie: ${entryQuantity(preview)}` : 'Bitte eine gültige Menge größer als 0 eingeben.'}</p>}
  </li>;
}
