import type {ShoppingItem} from '../planning';
import {shoppingAmount} from '../shoppingList';

export default function ShoppingChecklist({items, disabled, onToggle}: {
  items: ShoppingItem[]; disabled: boolean; onToggle: (item: ShoppingItem, checked: boolean) => void;
}) {
  return <ul className="shopping-checklist">{items.map(item => <li key={item.id}><label className={item.checked ? 'shopping-checked' : ''}>
    <input type="checkbox" data-shopping-id={item.id} aria-label={`${item.name} gekauft`} checked={item.checked} disabled={disabled} onChange={event => onToggle(item, event.target.checked)}/>
    <span><strong>{item.name}</strong>{item.brand && <small>{item.brand}</small>}</span><b>{shoppingAmount(item.grams)}</b>
  </label></li>)}</ul>;
}
