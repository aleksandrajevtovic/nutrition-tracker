import {useEffect, useId, useRef, useState} from 'react';
import {Copy} from 'lucide-react';
import type {ShoppingItem} from '../planning';
import {shoppingListText} from '../shoppingList';
import {useToast} from './ToastProvider';

export default function ShoppingListCopy({items, disabled}: {items: ShoppingItem[]; disabled: boolean}) {
  const [copying, setCopying] = useState(false), [manual, setManual] = useState(false);
  const running = useRef(false), field = useRef<HTMLTextAreaElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const id = useId(), notify = useToast();
  const text = shoppingListText(items);
  useEffect(() => {if (!items.length) setManual(false);}, [items.length]);
  useEffect(() => {if (manual) {field.current?.focus();field.current?.select();}}, [manual]);
  async function copy() {
    if (running.current || disabled || !items.length) return;
    running.current = true; setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw Error('Zwischenablage nicht verfügbar');
      await navigator.clipboard.writeText(text);setManual(false);notify('Einkaufsliste kopiert.', 'success');
    } catch {
      setManual(true);
      window.requestAnimationFrame(() => {field.current?.focus();field.current?.select();});
      notify('Automatisches Kopieren ist nicht möglich. Bitte den markierten Listentext manuell kopieren.', 'error');
    } finally {running.current = false;setCopying(false);}
  }
  return <>
    <button ref={trigger} type="button" className="secondary shopping-copy-button" disabled={disabled || copying || !items.length} onClick={() => void copy()}><Copy size={16} aria-hidden="true"/>{copying ? 'Wird kopiert…' : 'Liste kopieren'}</button>
    {manual && items.length > 0 && <div className="shopping-copy-manual">
      <label htmlFor={id}>Listentext manuell kopieren</label>
      <p className="hint" id={`${id}-hint`}>Der Text enthält offene und gekaufte Zutaten mit Mengen. Kopiere den markierten Text über das Menü deines Geräts.</p>
      <textarea ref={field} id={id} aria-label="Einkaufsliste zum Kopieren" aria-describedby={`${id}-hint`} readOnly rows={8} value={text} onFocus={event => event.currentTarget.select()}/>
      <button type="button" className="secondary" onClick={() => {setManual(false);trigger.current?.focus();}}>Listentext schließen</button>
    </div>}
  </>;
}
