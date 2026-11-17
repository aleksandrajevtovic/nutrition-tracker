import {Clock} from 'lucide-react';
import type {RecentFood} from '../diaryHistory';
import {entryQuantity} from '../quantityLabels';

export default function LastAmountSuggestion({item, disabled, onSelect}: {item: RecentFood; disabled: boolean; onSelect: (item: RecentFood) => void}) {
  const label = entryQuantity({foodSnapshot:item.food, amount:item.amount, unit:item.unit, grams:item.grams});
  return <button type="button" className="entry-editor__last-amount" disabled={disabled} aria-label={`Letzte Menge übernehmen: ${label}`} onClick={() => onSelect(item)}>
    <Clock size={15} aria-hidden="true"/><span>Zuletzt: {label}</span>
  </button>;
}
