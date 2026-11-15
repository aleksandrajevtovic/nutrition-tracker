import {germanError} from '../german';
import {useRef, useState} from 'react';
import {Check, Minus, Plus} from 'lucide-react';
import type {Entry, Food} from '../db';
import {useToast} from './ToastProvider';
import FoodPicker from './FoodPicker';
import PortionPicker from './PortionPicker';
import RecentFoods from './RecentFoods';
import type {RecentFood} from '../diaryHistory';
import './EntryEditor.css';
import {fmt, isPositive, meals, stats, toGrams, unitLabels, units, validFood, type Unit} from '../nutrition';

type Props = {
  foods: Food[];
  date: string;
  entry: Entry | null;
  onSave: (entry: Entry, conversions: Partial<Food>) => Promise<void>;
  onClose: () => void;
};

export default function EntryEditor({foods, date, entry, onSave, onClose}: Props) {
  const notify = useToast();
  const [selected, setSelected] = useState<Food | undefined>(entry?.foodSnapshot);
  const [meal, setMeal] = useState(entry?.meal ?? 'Frühstück');
  const [amount, setAmount] = useState(String(entry?.amount ?? entry?.grams ?? 1));
  const [unit, setUnit] = useState<Unit>(entry?.unit ?? (entry ? 'g' : 'portion'));
  const [conversions, setConversions] = useState<Partial<Food>>({});
  const [note, setNote] = useState(entry?.note ?? '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const food = selected ? {...selected, ...conversions} : undefined;
  const grams = food ? toGrams(food, Number(amount), unit) : NaN;
  const valid = Boolean(food && validFood(food) && isPositive(Number(amount)) && isPositive(grams));
  const preview = food && valid ? stats(food, grams) : null;
  const conversionKey = unit === 'ml' || unit === 'l' ? 'gramsPerMl'
    : unit === 'piece' ? 'pieceGrams' : unit === 'slice' ? 'sliceGrams' : null;
  const conversionLabel = conversionKey === 'gramsPerMl' ? 'Gramm pro ml'
    : conversionKey === 'pieceGrams' ? 'Gramm pro Stück' : 'Gramm pro Scheibe';
  const options = selected && !foods.some(f => f.id === selected.id) ? [selected, ...foods] : foods;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!food || !valid || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      await onSave({
        id: entry?.id ?? crypto.randomUUID(), foodId: food.id, date, meal, grams,
        amount: Number(amount), unit, foodSnapshot: {...food},
        ...(note.trim() ? {note: note.trim()} : {}),
        createdAt: entry?.createdAt ?? new Date().toISOString(),
      }, conversions);
    } catch (e) { notify(germanError(e), 'error'); }
    finally { savingRef.current = false; setSaving(false); }
  }

  async function addRecent(item: RecentFood) {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      await onSave({id: crypto.randomUUID(), foodId: item.food.id, date, meal, grams: item.grams, amount: item.amount,
        unit: item.unit, foodSnapshot: structuredClone(item.food), createdAt: new Date().toISOString(), ...(note.trim() ? {note: note.trim()} : {})}, {});
    } catch (error) {notify(germanError(error), 'error');}
    finally {savingRef.current = false; setSaving(false);}
  }

  return <form className="panel editor" onSubmit={submit}>
    <div className="section-head">
      <h3 tabIndex={-1}>{entry ? 'Eintrag bearbeiten' : 'Lebensmittel eintragen'}</h3>
      <button type="button" className="iconbtn" aria-label="Schließen" disabled={saving} onClick={onClose}>×</button>
    </div>
    <label>Mahlzeit<select aria-label="Mahlzeit" value={meal} onChange={e => setMeal(e.target.value)}>
      {Array.from(new Set([...meals, meal])).map(m => <option key={m}>{m}</option>)}
    </select></label>
    {!entry && <RecentFoods foods={foods} busy={saving} onSelect={item => {setSelected(item.food); setAmount(String(item.amount)); setUnit(item.unit); setConversions({});}} onAdd={item => void addRecent(item)}/>}
    <FoodPicker foods={options} selected={selected} onChange={food => {
      if (food.id === selected?.id) return;
      setSelected(food);
      setConversions({}); setAmount('1'); setUnit('portion');
    }}/>
    {food && <>
      {unit === 'portion' && <PortionPicker food={food} disabled={saving} onChange={setSelected}/>}
      <div className="quantity-fields">
        <label>Menge<input type="number" min="0" step="any" required value={amount} onChange={e => setAmount(e.target.value)}/></label>
        <label>Einheit<select value={unit} onChange={e => {
          // Keep the physical amount when switching between configured units.
          const next = e.target.value as Unit;
          const factor = toGrams(food, 1, next);
          if (isPositive(grams) && isPositive(factor)) setAmount(String(Number((grams / factor).toPrecision(12))));
          else if (!isPositive(factor)) setAmount('1');
          setUnit(next);
        }}>
          {units.map(u => <option key={u} value={u}>{u === 'portion' ? `Portion (${food.portionName})` : unitLabels[u]}</option>)}
        </select></label>
      </div>
      {conversionKey && <>
        <label>{conversionLabel}<input type="number" min="0" step="any" required
          value={food[conversionKey] ?? ''}
          onChange={e => setConversions({...conversions, [conversionKey]: e.target.value === '' ? undefined : Number(e.target.value)})}/></label>
        <p className="hint">{conversionKey === 'gramsPerMl'
          ? 'Für ml und l ist die Dichte nötig. Beispiel: Wasser ≈ 1 g/ml. Den passenden Wert für dieses Lebensmittel eingeben.'
          : 'Das Gewicht einer Einheit eingeben. Es wird für dieses Lebensmittel gespeichert.'}</p>
      </>}
      <p className="hint">1 × {food.portionName} = {fmt(food.portionGrams, 3)} g{valid ? ` · Gewählte Menge: ${fmt(grams, 3)} g` : ''}</p>
      {!valid && <p className="hint" role="status">Bitte eine positive Menge und gültige Umrechnungsgewichte eingeben.</p>}
      <div className="stepper">
        <button type="button" aria-label="Menge verringern" onClick={() => setAmount(String(Math.max(0, Number(amount) - 1)))}><Minus size={18}/></button>
        <strong>{fmt(Number(amount), 3)} {unitLabels[unit]}</strong>
        <button type="button" aria-label="Menge erhöhen" onClick={() => setAmount(String(Number(amount) + 1))}><Plus size={18}/></button>
      </div>
      {preview && <div className="preview"><b>{Math.round(preview.kcal)} kcal</b><span>P {fmt(preview.protein)} g · KH {fmt(preview.carbs)} g · F {fmt(preview.fat)} g</span></div>}
    </>}
    <label>Notiz zum Eintrag (optional)<textarea aria-label="Notiz zum Eintrag (optional)" rows={3} value={note} disabled={saving} onChange={event => setNote(event.target.value)} placeholder="z. B. mit Kräutern zubereitet oder nach dem Training"/></label>
    <button className="primary wide" disabled={!valid || saving}><Check size={17}/>{saving ? 'Wird gespeichert…' : entry ? 'Änderungen speichern' : 'Zum Tag hinzufügen'}</button>
  </form>;
}
