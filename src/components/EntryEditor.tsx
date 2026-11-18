import {useDraftState} from './DraftRecoveryProvider';
import {germanError} from '../german';
import {useMemo, useRef, useState} from 'react';
import {Check, Minus, Plus, ScanBarcode} from 'lucide-react';
import type {Entry, Food} from '../db';
import {useToast} from './ToastProvider';
import FoodPicker from './FoodPicker';
import FoodEditor from './FoodEditor';
import PortionPicker from './PortionPicker';
import RecentFoods from './RecentFoods';
import {useDraftGuard} from './UnsavedChangesProvider';
import {lastUsedAmount, type RecentFood} from '../diaryHistory';
import {useDiaryHistory} from '../hooks/useDiaryHistory';
import LastAmountSuggestion from './LastAmountSuggestion';
import ProductImport from './ProductImport';
import {portionNameLabel, portionQuantity} from '../quantityLabels';
import './EntryEditor.css';
import {emptyFood, fmt, isPositive, meals, stats, toGrams, unitLabels, units, validFood, type Unit} from '../nutrition';

type Props = {
  foods: Food[];
  date: string;
  entry: Entry | null;
  initialMeal?: string;
  onSave: (entry: Entry, conversions: Partial<Food>, keepOpen?: boolean) => Promise<void>;
  onClose: () => void;
  onSaveFood: (food: Food) => Promise<void>;
};

export default function EntryEditor({foods, date, entry, initialMeal = 'Frühstück', onSave, onClose, onSaveFood}: Props) {
  const notify = useToast();
  const [draftId] = useDraftState('EntryEditor:draftId', () => entry?.id ?? crypto.randomUUID());
  const [selected, setSelected] = useDraftState<Food | undefined>('EntryEditor:selected', entry?.foodSnapshot);
  const [meal, setMeal] = useDraftState('EntryEditor:meal', entry?.meal ?? initialMeal);
  const [amount, setAmount] = useDraftState('EntryEditor:amount', String(entry?.amount ?? entry?.grams ?? 1));
  const [unit, setUnit] = useDraftState<Unit>('EntryEditor:unit', entry?.unit ?? (entry ? 'g' : 'portion'));
  const [conversions, setConversions] = useDraftState<Partial<Food>>('EntryEditor:conversions', {});
  const [note, setNote] = useDraftState('EntryEditor:note', entry?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [importing,setImporting] = useDraftState('EntryEditor:importing', false);
  const [creatingFood,setCreatingFood] = useDraftState<Food | null>('EntryEditor:creatingFood', null);
  const form = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  const amountInput = useRef<HTMLInputElement>(null);
  const history = useDiaryHistory(!entry);
  const lastAmount = useMemo(() => !entry && selected && !history.loading && !history.failed
    ? lastUsedAmount(history.entries, foods.find(food => food.id === selected.id) ?? selected) : undefined,
  [entry, selected, foods, history.entries, history.loading, history.failed]);
  const guard = useDraftGuard('Tagebucheintrag', {selected, meal, amount, unit, conversions, note}, saving, 'entry-editor');
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
    if (!food || !valid || savingRef.current || creatingFood) return;
    const keepOpen = !entry && (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'continue';
    savingRef.current = true; setSaving(true);
    try {
      await onSave({
        id: draftId, foodId: food.id, date, meal, grams,
        amount: Number(amount), unit, foodSnapshot: {...food},
        ...(note.trim() ? {note: note.trim()} : {}),
        createdAt: entry?.createdAt ?? new Date().toISOString(),
      }, conversions, keepOpen);
      guard.markSaved();
    } catch (e) { notify(germanError(e), 'error'); }
    finally { savingRef.current = false; setSaving(false); }
  }

  async function addRecent(item: RecentFood) {
    if (savingRef.current || creatingFood) return;
    savingRef.current = true; setSaving(true);
    try {
      await onSave({id: draftId, foodId: item.food.id, date, meal, grams: item.grams, amount: item.amount,
        unit: item.unit, foodSnapshot: structuredClone(item.food), createdAt: new Date().toISOString(), ...(note.trim() ? {note: note.trim()} : {})}, {}); guard.markSaved();
    } catch (error) {notify(germanError(error), 'error');}
    finally {savingRef.current = false; setSaving(false);}
  }

  return <><form ref={form} className="panel editor" onSubmit={submit} inert={Boolean(creatingFood)}>
    <div className="section-head">
      <h3 tabIndex={-1}>{entry ? 'Eintrag bearbeiten' : 'Lebensmittel eintragen'}</h3>
      <button type="button" className="iconbtn" aria-label="Schließen" disabled={saving} onClick={() => {if (guard.confirmLeave()) onClose();}}>×</button>
    </div>
    <label>Mahlzeit<select aria-label="Mahlzeit" value={meal} disabled={saving} onChange={e => setMeal(e.target.value)}>
      {Array.from(new Set([...meals, meal])).map(m => <option key={m}>{m}</option>)}
    </select></label>
    {!entry && <RecentFoods foods={foods} history={history} busy={saving} onSelect={item => {setSelected(item.food); setAmount(String(item.amount)); setUnit(item.unit); setConversions({});}} onAdd={item => void addRecent(item)}/>}
    {!entry && <button type="button" className="secondary wide" disabled={saving} onClick={() => setImporting(true)}><ScanBarcode size={17}/>Produkt scannen</button>}
    {importing && <ProductImport foods={foods} onSave={onSaveFood} onClose={() => setImporting(false)} onSelect={food => {setSelected(food);setConversions({});setAmount('1');setUnit(food.nutritionReference?.unit === 'ml' ? 'ml' : 'portion');if (food.nutritionReference?.unit === 'ml') setAmount('100');}}/>}
    <FoodPicker foods={options} selected={selected} disabled={saving} onCreate={name => setCreatingFood({...emptyFood(),name})} onChange={food => {
      if (food.id === selected?.id) return;
      setSelected(food);
      setConversions({}); setAmount('1'); setUnit('portion');
    }}/>
    {lastAmount && <LastAmountSuggestion item={lastAmount} disabled={saving} onSelect={item => {
      setSelected(item.food);setAmount(String(item.amount));setUnit(item.unit);setConversions({});
      window.requestAnimationFrame(() => {amountInput.current?.focus();amountInput.current?.select();});
    }}/>}
    {food && <>
      {unit === 'portion' && <PortionPicker food={food} disabled={saving} onChange={setSelected}/>}
      <div className="quantity-fields">
        <label>Menge<input ref={amountInput} type="number" min="0" step="any" required value={amount} disabled={saving} onChange={e => setAmount(e.target.value)}/></label>
        <label>Einheit<select aria-label="Einheit" value={unit} disabled={saving} onChange={e => {
          // Keep the physical amount when switching between configured units.
          const next = e.target.value as Unit;
          const factor = toGrams(food, 1, next);
          if (isPositive(grams) && isPositive(factor)) setAmount(String(Number((grams / factor).toPrecision(12))));
          else if (!isPositive(factor)) setAmount('1');
          setUnit(next);
        }}>
          {units.map(u => <option key={u} value={u}>{u === 'portion' ? `Portion (${portionNameLabel(food.portionName)})` : unitLabels[u]}</option>)}
        </select></label>
      </div>
      {conversionKey && <>
        <label>{conversionLabel}<input type="number" min="0" step="any" required disabled={saving}
          value={food[conversionKey] ?? ''}
          onChange={e => setConversions({...conversions, [conversionKey]: e.target.value === '' ? undefined : Number(e.target.value)})}/></label>
        <p className="hint">{conversionKey === 'gramsPerMl'
          ? 'Für ml und l ist die Dichte nötig. Beispiel: Wasser ≈ 1 g/ml. Den passenden Wert für dieses Lebensmittel eingeben.'
          : 'Das Gewicht einer Einheit eingeben. Es wird für dieses Lebensmittel gespeichert.'}</p>
      </>}
      <p className="hint">{portionQuantity(1,food.portionName,food.portionGrams)}{valid ? ` · Gewählte Menge: ${unit === 'portion' ? portionQuantity(Number(amount),food.portionName,grams) : `${fmt(grams,3)} g`}` : ''}</p>
      {!valid && <p className="hint" role="status">Bitte eine positive Menge und gültige Umrechnungsgewichte eingeben.</p>}
      <div className="stepper">
        <button type="button" disabled={saving} aria-label="Menge verringern" onClick={() => setAmount(String(Math.max(0, Number(amount) - 1)))}><Minus size={18}/></button>
        <strong>{unit === 'portion' ? portionQuantity(Number(amount),food.portionName) : `${fmt(Number(amount),3)} ${unitLabels[unit]}`}</strong>
        <button type="button" disabled={saving} aria-label="Menge erhöhen" onClick={() => setAmount(String(Number(amount) + 1))}><Plus size={18}/></button>
      </div>
      {preview && <div className="preview"><b>{Math.round(preview.kcal)} kcal</b><span>Eiweiß {fmt(preview.protein)} g · KH {fmt(preview.carbs)} g · F {fmt(preview.fat)} g</span></div>}
    </>}
    <label>Notiz zum Eintrag (optional)<textarea aria-label="Notiz zum Eintrag (optional)" rows={3} value={note} disabled={saving} onChange={event => setNote(event.target.value)} placeholder="z. B. mit Kräutern zubereitet oder nach dem Training"/></label>
    <div className="entry-editor__save-actions"><button className="primary wide" value="close" disabled={!valid || saving}><Check size={17}/>{saving ? 'Wird gespeichert…' : entry ? 'Änderungen speichern' : 'Zum Tag hinzufügen'}</button>
      {!entry && <button type="submit" className="secondary wide" value="continue" disabled={!valid || saving}><Plus size={17}/>Speichern und weiteres hinzufügen</button>}</div>
  </form>
    {creatingFood && <FoodEditor key={creatingFood.id} food={creatingFood} existing={false} saveLabel="Speichern und zum Eintrag" description="Dein Tagebucheintrag bleibt erhalten. Nach dem Speichern gibst du die Menge ein."
      onClose={() => {
        setCreatingFood(null);
        window.requestAnimationFrame(() => form.current?.querySelector<HTMLButtonElement>('.food-picker__trigger')?.focus());
      }} onSave={async created => {
        await onSaveFood(created);
        setSelected(created);setConversions({});setAmount('');
        setUnit(created.nutritionReference?.unit === 'ml' ? 'ml' : created.nutritionReference?.unit === 'portion' ? 'portion' : 'g');
        setCreatingFood(null);
        window.requestAnimationFrame(() => amountInput.current?.focus());
      }}/>}
  </>;
}
