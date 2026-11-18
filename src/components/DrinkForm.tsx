import {useDraftState} from './DraftRecoveryProvider';
import {useId} from 'react';
import {Check, X} from 'lucide-react';
import {createDrink, drinkMilliliters, drinkTimeNow, type Drink, type DrinkUnit} from '../hydration';
import {fmt} from '../nutrition';
import {useDraftGuard} from './UnsavedChangesProvider';

export default function DrinkForm({date, drink, busy, pending, onSave, onCancel}: {
  date: string; drink?: Drink; busy: boolean; pending: boolean; onSave: (action: () => Drink, onSaved?: () => void) => void; onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useDraftState(`DrinkForm:${date}:name`, drink?.name ?? 'Wasser');
  const [amount, setAmount] = useDraftState(`DrinkForm:${date}:amount`, drink ? String(drink.ml).replace('.', ',') : '250');
  const [unit, setUnit] = useDraftState<DrinkUnit>(`DrinkForm:${date}:unit`, 'ml');
  const [time, setTime] = useDraftState(`DrinkForm:${date}:time`, drink?.time ?? drinkTimeNow());
  const guard = useDraftGuard('Getränk', {name, amount, unit, time}, pending, 'drink-form');
  return <form className="drink-form" onSubmit={event => {event.preventDefault(); onSave(() => createDrink(date, name, amount, unit, time, drink), guard.markSaved);}}>
    <h3 tabIndex={-1}>{drink ? 'Getränk bearbeiten' : 'Getränk eintragen'}</h3>
    <label>Getränk<input aria-label="Getränk" list={`${id}-drinks`} value={name} required disabled={busy} onChange={event => setName(event.target.value)}/></label>
    <datalist id={`${id}-drinks`}>{['Wasser', 'Tee', 'Kaffee', 'Saft', 'Milch'].map(value => <option key={value} value={value}/>)}</datalist>
    <div className="drink-form__fields"><label>Trinkmenge<input aria-label="Trinkmenge" type="text" inputMode="decimal" required value={amount} disabled={busy} onChange={event => setAmount(event.target.value)}/></label>
      <label>Einheit<select aria-label="Einheit der Trinkmenge" value={unit} disabled={busy} onChange={event => {
        const next = event.target.value as DrinkUnit;
        const ml = drinkMilliliters(amount, unit);
        if (Number.isFinite(ml)) setAmount(String(Number((ml / (next === 'l' ? 1000 : 1)).toPrecision(12))).replace('.', ','));
        setUnit(next);
      }}><option value="ml">ml</option><option value="l">l</option></select></label>
      <label>Uhrzeit<input aria-label="Uhrzeit des Getränks" type="time" required value={time} disabled={busy} onChange={event => setTime(event.target.value)}/></label></div>
    <div className="drink-form__actions"><button className="primary" disabled={busy}><Check size={16}/>{busy ? 'Wird gespeichert…' : drink ? 'Getränk aktualisieren' : 'Getränk hinzufügen'}</button>
      {drink && <button type="button" className="secondary" disabled={busy} onClick={() => {if (guard.confirmLeave()) onCancel();}}><X size={16}/>Bearbeiten abbrechen</button>}</div>
    <p className="hint">{fmt(drinkMilliliters(amount, unit) || 0, 3)} ml · {drink ? 'Änderungen gelten für diesen Eintrag.' : 'Eigene Getränkenamen sind möglich.'} Getränke mit Kalorien zusätzlich als Lebensmittel eintragen, damit ihre Nährwerte mitzählen.</p>
  </form>;
}
