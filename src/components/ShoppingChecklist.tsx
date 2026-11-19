import type {ShoppingItem} from '../planning';
import {shoppingItemAmount} from '../shoppingList';
import {Trash2} from 'lucide-react';

export default function ShoppingChecklist({items, disabled, onToggle, onRemove}: {
  items: ShoppingItem[]; disabled: boolean; onToggle: (item: ShoppingItem, checked: boolean) => void;
  onRemove: (item: ShoppingItem) => void;
}) {
  return <ul className="shopping-checklist">{items.map(item => <li key={item.id}><label className={item.checked ? 'shopping-checked' : ''}>
    <input type="checkbox" data-shopping-id={item.id} aria-label={`${item.name} gekauft`} checked={item.checked} disabled={disabled} onChange={event => onToggle(item, event.target.checked)}/>
    <span><strong>{item.name}</strong>{item.brand && <small>{item.brand}</small>}</span><b>{shoppingItemAmount(item)}</b>
  </label><button type="button" className="iconbtn shopping-item-remove" data-shopping-remove-id={item.id} disabled={disabled} aria-label={`${item.name} aus Einkaufsliste entfernen`} title="Aus Einkaufsliste entfernen" onClick={() => onRemove(item)}><Trash2 size={17} aria-hidden="true"/></button></li>)}</ul>;
}
