import {useDraftState} from './DraftRecoveryProvider';
import {useEffect, useRef, useState} from 'react';
import {ChevronDown, Plus, ShoppingBasket, Trash2} from 'lucide-react';
import type {Food} from '../db';
import {getDataRevision} from '../db';
import {itemFromFood, type ShoppingItem, type ShoppingList} from '../planning';
import {clearShopping, removeShoppingItem, restoreShopping, restoreShoppingItem, setShoppingFromMeals, toggleShoppingItem} from '../planningDb';
import {isPositive} from '../nutrition';
import {groupShoppingItems} from '../shoppingList';
import {germanError} from '../german';
import FoodPicker from './FoodPicker';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';
import ShoppingChecklist from './ShoppingChecklist';
import ShoppingListCopy from './ShoppingListCopy';
import './ShoppingListView.css';

type Selection = {id: string; food: Food; portions: number};

export default function ShoppingListView({foods, shopping}: {foods: Food[]; shopping: ShoppingList}) {
  const [selected, setSelected] = useDraftState<Food>('ShoppingListView:selected');
  const [portions, setPortions] = useDraftState('ShoppingListView:portions', '1');
  const [selection, setSelection] = useDraftState<Selection[]>('ShoppingListView:selection', []);
  const [selectionOpen, setSelectionOpen] = useDraftState('ShoppingListView:selectionOpen', false);
  const [busy, setBusy] = useState(false);
  const [pendingChecks, setPendingChecks] = useState<Record<string, boolean>>({});
  const running = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const items = shopping.items.map(item => ({...item, checked: pendingChecks[item.id] ?? item.checked}));
  const {open, purchased} = groupShoppingItems(items);
  const notify = useToast();
  const guard = useDraftGuard('Rezeptauswahl für die Einkaufsliste', selection, busy, 'shopping-selection');
  useDraftGuard('Noch nicht hinzugefügtes Einkaufsrezept', {selected, portions}, false, 'shopping-pending');
  useEffect(() => {
    setPendingChecks(current => Object.fromEntries(Object.entries(current).filter(([id, checked]) => {
      const item = shopping.items.find(item => item.id === id);
      return item && item.checked !== checked;
    })));
  }, [shopping]);
  async function run(action: () => Promise<void>, message?: string) {
    if (running.current) return;
    running.current = true; setBusy(true);
    try {await action(); if (message) notify(message, 'success');}
    catch (error) {notify(germanError(error), 'error');}
    finally {running.current = false; setBusy(false);}
  }
  function add() {
    if (!selected || !isPositive(Number(portions))) {notify('Bitte ein Rezept und eine positive Portionsanzahl wählen.', 'error'); return;}
    setSelection([...selection, {id: crypto.randomUUID(), food: structuredClone(selected), portions: Number(portions)}]);
    setSelected(undefined); setPortions('1');
  }
  function generate(append: boolean) {
    if (!append && shopping.items.length && !confirm('Vorhandene Einkaufsliste ersetzen? Die bisherigen Häkchen werden zurückgesetzt.')) return;
    setPendingChecks({});
    void run(async () => {await setShoppingFromMeals(selection.map(row => itemFromFood(row.food, row.portions, 'portion')), append); guard.markSaved();}, 'Einkaufsliste aktualisiert.');
  }
  async function clear() {
    setPendingChecks({});
    const revision = getDataRevision();
    const {previous, clearedAt} = await clearShopping();
    notify('Einkaufsliste geleert.', 'success', {label: 'Rückgängig', onClick: async () => {await restoreShopping(previous, clearedAt, revision); notify('Einkaufsliste wiederhergestellt.', 'success');}});
  }
  async function toggle(item: ShoppingItem, checked: boolean) {
    if (running.current) return;
    const restoreFocus = document.activeElement?.getAttribute('data-shopping-id') === item.id;
    const remaining = open.filter(current => current.id !== item.id);
    const next = checked ? remaining[Math.min(open.findIndex(current => current.id === item.id), remaining.length - 1)]?.id : item.id;
    let saved = false;
    setPendingChecks(current => ({...current, [item.id]: checked}));
    await run(async () => {
      try {await toggleShoppingItem(item.id, checked);saved = true;}
      catch (error) {setPendingChecks(current => {const next = {...current};delete next[item.id];return next;});throw error;}
    });
    if (restoreFocus) window.requestAnimationFrame(() => {
      if (document.activeElement !== document.body && document.activeElement?.getAttribute('data-shopping-id') !== item.id) return;
      const target = [...(list.current?.querySelectorAll<HTMLInputElement>('input[data-shopping-id]') ?? [])].find(input => input.dataset.shoppingId === (saved ? next : item.id));
      (target ?? list.current?.querySelector<HTMLElement>('summary'))?.focus({preventScroll:true});
    });
  }
  async function remove(item: ShoppingItem) {
    const focused = document.activeElement?.getAttribute('data-shopping-remove-id') === item.id;
    const group = item.checked ? purchased : open;
    const remaining = group.filter(current => current.id !== item.id);
    const next = remaining[Math.min(group.findIndex(current => current.id === item.id), remaining.length - 1)]?.id;
    let removed = false;
    await run(async () => {
      const result = await removeShoppingItem(item.id);removed = true;
      notify(`„${result.item.name}“ aus Einkaufsliste entfernt.`, 'success', {label: 'Rückgängig', onClick: async () => {
        await restoreShoppingItem(result);notify('Einkaufsposition wiederhergestellt.', 'success');
      }});
    });
    if (focused && removed) window.requestAnimationFrame(() => {
      if (document.activeElement !== document.body && document.activeElement?.getAttribute('data-shopping-remove-id') !== item.id) return;
      const inputs = [...(list.current?.querySelectorAll<HTMLInputElement>('input[data-shopping-id]') ?? [])].filter(input => input.getClientRects().length);
      (inputs.find(input => input.dataset.shoppingId === next) ?? inputs[0] ?? list.current?.querySelector<HTMLElement>('summary') ?? heading.current)?.focus({preventScroll:true});
    });
  }

  return <>
    <details className="panel editor shopping-recipe-selection" open={selectionOpen} onToggle={event => setSelectionOpen(event.currentTarget.open)}>
      <summary><h2>Einkaufsliste aus Rezepten{(selection.length > 0 || selected) && <small>Auswahl vorhanden</small>}</h2><ChevronDown size={18} aria-hidden="true"/></summary>
      <p className="hint">Rezepte und benötigte Portionen wählen. Gleiche Zutaten werden in Gramm zusammengezählt. Enthaltene Unterrezepte erscheinen als eigene Zutat.</p>
      {foods.some(food => food.recipe) ? <>
        <FoodPicker foods={foods.filter(food => food.recipe)} selected={selected} disabled={busy} onChange={setSelected}/>
        <label>Benötigte Portionen<input type="number" min="0" step="any" value={portions} disabled={busy} onChange={event => setPortions(event.target.value)}/></label>
        <button type="button" className="secondary wide" disabled={busy || !selected} onClick={add}><Plus size={17}/>Rezept zur Auswahl hinzufügen</button>
      </> : <p className="hint">Lege unter „Produkte → Neues Rezept“ zuerst ein Rezept an.</p>}
      {selection.length > 0 && <>
        <ul className="shopping-selections">{selection.map(row => <li key={row.id}><div><strong>{row.food.name}</strong><label>Portionen<input aria-label={`Portionen für ${row.food.name}`} type="number" min="0" step="any" value={row.portions} disabled={busy}
          onChange={event => setSelection(selection.map(current => current.id === row.id ? {...current, portions: Number(event.target.value)} : current))}/></label></div>
          <button type="button" className="iconbtn" aria-label={`${row.food.name} aus Auswahl entfernen`} disabled={busy} onClick={() => setSelection(selection.filter(current => current.id !== row.id))}><Trash2 size={17}/></button></li>)}</ul>
        <div className="planning-actions"><button type="button" className="primary" disabled={busy || selection.some(row => !isPositive(row.portions))} onClick={() => generate(false)}>Liste erstellen / ersetzen</button>
          <button type="button" className="secondary" disabled={busy || selection.some(row => !isPositive(row.portions))} onClick={() => generate(true)}>Zur Liste hinzufügen</button></div>
      </>}
    </details>
    <section className="panel" aria-labelledby="shopping-list-title"><div className="section-head shopping-list__heading"><h2 ref={heading} tabIndex={-1} id="shopping-list-title">Deine Einkaufsliste</h2>
      <ShoppingListCopy items={items} disabled={busy}/>
      <button type="button" className="iconbtn" disabled={busy || !shopping.items.length} aria-label="Einkaufsliste leeren" onClick={() => void run(clear)}><Trash2 size={17}/></button></div>
      {!shopping.items.length ? <div className="empty"><ShoppingBasket size={28}/><strong>Die Liste ist leer</strong><p>Erstelle eine Liste aus Rezepten oder aus deinem Wochenplan.</p></div> : <>
        <p className="hint" role="status">{purchased.length} von {items.length} Zutaten abgehakt. Beim Hinzufügen weiterer Mengen werden betroffene Häkchen zurückgesetzt.</p>
        <div ref={list}>
          <div className="shopping-open"><h3>Noch offen ({open.length})</h3>
            {open.length ? <ShoppingChecklist items={open} disabled={busy} onToggle={(item, checked) => void toggle(item, checked)} onRemove={item => void remove(item)}/> : <p className="hint" role="status">Alles eingekauft.</p>}
          </div>
          {purchased.length > 0 && <details className="shopping-purchased"><summary><span>Gekauft ({purchased.length})</span><ChevronDown size={17} aria-hidden="true"/></summary>
            <ShoppingChecklist items={purchased} disabled={busy} onToggle={(item, checked) => void toggle(item, checked)} onRemove={item => void remove(item)}/>
          </details>}
        </div>
      </>}
    </section>
  </>;
}
