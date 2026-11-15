import {germanError} from '../german';
import {useState} from 'react';
import {Check} from 'lucide-react';
import type {Food} from '../db';
import {fmt, isPositive, validFood} from '../nutrition';
import {defaultReference, nutrientKeys, referenceGrams, scaleNutrients, type NutritionReference} from '../foodValues';
import {useToast} from './ToastProvider';
import FoodPortions from './FoodPortions';
import {useDraftGuard} from './UnsavedChangesProvider';
import './FoodEditor.css';

const fields = [
  ['name', 'Name', 'text'], ['brand', 'Marke (optional)', 'text'],
  ['portionName', 'Portionsname (z. B. 1 Esslöffel oder 1 Becher)', 'text'],
  ['portionGrams', 'Gramm pro Portion', 'number'],
  ['pieceGrams', 'Gramm pro Stück (optional)', 'number'],
  ['sliceGrams', 'Gramm pro Scheibe (optional)', 'number'],
  ['gramsPerMl', 'Gramm pro ml / Dichte (optional)', 'number'],
] as const;
const labels = {kcal: 'Kalorien', protein: 'Protein', carbs: 'Kohlenhydrate', fat: 'Fett', fiber: 'Ballaststoffe', sugar: 'Zucker'};
const referenceMode = (reference: NutritionReference) => reference.unit === 'portion' ? 'portion' : reference.unit === 'ml' ? '100ml' : reference.amount === 100 ? '100g' : 'custom';

export default function FoodEditor({food, existing, onSave, onClose}: {
  food: Food; existing: boolean; onSave: (food: Food) => Promise<void>; onClose: () => void;
}) {
  const notify = useToast();
  const [reference, setReference] = useState<NutritionReference>(food.nutritionReference ?? defaultReference);
  const [mode, setMode] = useState(referenceMode(reference));
  const [draft, setDraft] = useState(() => scaleNutrients(food, referenceGrams(food, reference) / 100));
  const [saving, setSaving] = useState(false);
  const guard = useDraftGuard('Lebensmittel', {draft, reference, mode}, saving, 'food-editor');
  const grams = referenceGrams(draft, reference);
  const normalized = scaleNutrients(draft, 100 / grams);
  const suffix = reference.unit === 'portion' ? `Portion (${fmt(draft.portionGrams, 3)} g)` : `${fmt(reference.amount, 3)} ${reference.unit}`;

  function changeMode(nextMode: string) {
    const next: NutritionReference = nextMode === 'portion' ? {unit: 'portion', amount: 1} : nextMode === '100ml' ? {unit: 'ml', amount: 100} : {unit: 'g', amount: nextMode === 'custom' ? draft.portionGrams : 100};
    const nextGrams = referenceGrams(draft, next);
    if (isPositive(grams) && isPositive(nextGrams)) setDraft(scaleNutrients(draft, nextGrams / grams));
    setReference(next); setMode(nextMode);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const result = {...normalized, nutritionReference: reference, name: draft.name.trim(), portionName: draft.portionName.trim(),
      portions: draft.portions?.map(portion => ({...portion, name: portion.name.trim()}))};
    if (!isPositive(grams) || !validFood(result)) {
      notify('Bitte Namen, eindeutige Portionsnamen, positive Gewichte und gültige Nährwerte eingeben.', 'error'); return;
    }
    setSaving(true);
    try { await onSave(result); guard.markSaved(); }
    catch (e) { notify(germanError(e), 'error'); }
    finally { setSaving(false); }
  }

  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="food-editor-title">
    <form className="modal food-editor editor" onSubmit={submit}>
      <div className="section-head"><h2 id="food-editor-title">Lebensmittel {existing ? 'bearbeiten' : 'anlegen'}</h2>
        <button type="button" className="iconbtn" aria-label="Schließen" disabled={saving} onClick={() => {if (guard.confirmLeave()) onClose();}}>×</button></div>
      <div className="fields">{fields.map(([key, label, type]) => {
        const optional = key === 'pieceGrams' || key === 'sliceGrams' || key === 'gramsPerMl';
        return <label key={key}>{label}<input type={type} min={type === 'number' ? 0 : undefined} disabled={saving}
          step={type === 'number' ? 'any' : undefined} required={!optional && key !== 'brand'}
          value={typeof draft[key] === 'number' && Number.isNaN(draft[key]) ? '' : draft[key] ?? ''} onChange={e => setDraft({...draft,
            [key]: type === 'number' ? (e.target.value === '' ? (optional ? undefined : NaN) : Number(e.target.value)) : e.target.value,
          })}/></label>;
      })}</div>
      <FoodPortions portions={draft.portions ?? []} onChange={portions => setDraft({...draft, portions})} disabled={saving}/>
      <section className="food-editor__nutrition" aria-labelledby="food-nutrition-title">
        <h3 id="food-nutrition-title">Nährwerte</h3>
        <label>Nährwerte beziehen sich auf<select value={mode} disabled={saving} onChange={event => changeMode(event.target.value)}>
          <option value="100g">100 g</option><option value="100ml">100 ml</option><option value="portion">1 Portion</option><option value="custom">Eigene Menge in g</option>
        </select></label>
        {mode === 'custom' && <label>Bezugsmenge in g<input type="number" min="0" step="any" required value={Number.isFinite(reference.amount) ? reference.amount : ''} disabled={saving} onChange={event => setReference({unit: 'g', amount: event.target.value === '' ? NaN : Number(event.target.value)})}/></label>}
        <p className="hint">{mode === 'portion' ? `Trage die Werte für 1 × ${draft.portionName} ein, zum Beispiel 116 kcal für eine Kartoffel mit 150 g.` : 'Wähle zuerst die Bezugsmenge und übertrage dann die dazugehörigen Nährwerte.'} Für ml wird die Dichte oben benötigt. Bei einer Änderung des Bezugsgewichts bleiben deine eingegebenen Zahlen erhalten.</p>
        <div className="fields">{nutrientKeys.map(key => <label key={key}>{labels[key]} / {suffix}<input type="number" min="0" step="any" required disabled={saving}
          value={Number.isFinite(draft[key]) ? draft[key] : ''} onChange={event => setDraft({...draft, [key]: event.target.value === '' ? NaN : Number(event.target.value)})}/></label>)}</div>
        {isPositive(grams) && Number.isFinite(normalized.kcal) && <p className="hint" aria-live="polite">Entspricht {fmt(normalized.kcal, 2)} kcal pro 100 g · {fmt(normalized.kcal * draft.portionGrams / 100, 2)} kcal pro Portion ({fmt(draft.portionGrams, 3)} g).</p>}
      </section>
      <button className="primary wide" disabled={saving}><Check size={17}/>{saving ? 'Wird gespeichert…' : 'Produkt speichern'}</button>
    </form>
  </div>;
}
