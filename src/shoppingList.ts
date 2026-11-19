import type {ShoppingItem} from './planning';
import {fmt} from './nutrition';
import {portionQuantity} from './quantityLabels';
export const shoppingItemAmount = (item: ShoppingItem) => item.quantity ? portionQuantity(item.quantity.amount, item.quantity.unitLabel, item.grams > 0 ? item.grams : undefined) : shoppingAmount(item.grams);

export const shoppingAmount = (grams: number) => grams >= 1000 ? `${fmt(grams / 1000, 3)} kg` : `${fmt(grams, 3)} g`;
export const groupShoppingItems = (items: ShoppingItem[]) => ({open: items.filter(item => !item.checked), purchased: items.filter(item => item.checked)});

export function shoppingListText(items: ShoppingItem[]): string {
  const {open, purchased} = groupShoppingItems(items);
  const line = (item: ShoppingItem) => {
    const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
    return `[${item.checked ? 'x' : ' '}] ${clean(item.name)}${item.brand.trim() ? ` (${clean(item.brand)})` : ''} · ${shoppingItemAmount(item)}`;
  };
  const sections = ['Einkaufsliste'];
  if (open.length) sections.push(`Noch offen (${open.length})\n${open.map(line).join('\n')}`);
  if (purchased.length) sections.push(`Gekauft (${purchased.length})\n${purchased.map(line).join('\n')}`);
  if (!items.length) sections.push('Die Liste ist leer.');
  return sections.join('\n\n');
}
