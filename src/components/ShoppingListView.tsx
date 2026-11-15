import {useEffect, useRef, useState} from 'react';
import {Plus, ShoppingBasket, Trash2} from 'lucide-react';
import type {Food} from '../db';
import {getDataRevision} from '../db';
import {itemFromFood, type ShoppingList} from '../planning';
import {clearShopping, restoreShopping, setShoppingFromMeals, toggleShoppingItem} from '../planningDb';
import {fmt, isPositive} from '../nutrition';
import {germanError} from '../german';
import FoodPicker from './FoodPicker';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';

type Selection = {id: string; food: Food; portions: number};
const amount = (grams: number) => grams >= 1000 ? `${fmt(grams / 1000, 3)} kg` : `${fmt(grams, 3)} g`;

export default function ShoppingListView({foods, shopping}: {foods: Food[]; shopping: ShoppingList}) {
  const [selected, setSelected] = useState<Food>();
  const [portions, setPortions] = useState('1');
  const [selection, setSelection] = useState<Selection[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingChecks, setPendingChecks] = useState<Record<string, boolean>>({});
  const running = useRef(false);
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

  return <>
    <section className="panel editor"><h2>Einkaufsliste aus Rezepten</h2>
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
    </section>
    <section className="panel" aria-labelledby="shopping-list-title"><div className="section-head"><h2 id="shopping-list-title">Deine Einkaufsliste</h2>
      <button type="button" className="iconbtn" disabled={busy || !shopping.items.length} aria-label="Einkaufsliste leeren" onClick={() => void run(clear)}><Trash2 size={17}/></button></div>
      {!shopping.items.length ? <div className="empty"><ShoppingBasket size={28}/><strong>Die Liste ist leer</strong><p>Erstelle eine Liste aus Rezepten oder aus deinem Wochenplan.</p></div> : <>
        <p className="hint" role="status">{shopping.items.filter(item => item.checked).length} von {shopping.items.length} Zutaten abgehakt. Beim Hinzufügen weiterer Mengen werden betroffene Häkchen zurückgesetzt.</p>
        <ul className="shopping-checklist">{shopping.items.map(item => <li key={item.id}><label className={(pendingChecks[item.id] ?? item.checked) ? 'shopping-checked' : ''}>
          <input type="checkbox" aria-label={`${item.name} gekauft`} checked={pendingChecks[item.id] ?? item.checked} disabled={busy} onChange={event => {
            if (running.current) return;
            const checked = event.target.checked;
            setPendingChecks(current => ({...current, [item.id]: checked}));
            void run(async () => {
              try {await toggleShoppingItem(item.id, checked);}
              catch (error) {setPendingChecks(current => {const next = {...current}; delete next[item.id]; return next;}); throw error;}
            });
          }}/>
          <span><strong>{item.name}</strong>{item.brand && <small>{item.brand}</small>}</span><b>{amount(item.grams)}</b>
        </label></li>)}</ul>
      </>}
    </section>
  </>;
}
