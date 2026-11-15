import {germanError} from '../german';
import {useState} from 'react';
import {Check} from 'lucide-react';
import type {Food} from '../db';
import {fmt, isPositive, validFood} from '../nutrition';
import {defaultReference, nutrientKeys, referenceGrams, scaleNutrients, type NutritionReference} from '../foodValues';
import {useToast} from './ToastProvider';
import FoodPortions from './FoodPortions';
import {useDraftGuard} from './UnsavedChangesProvider';
import {useImportDialog} from '../hooks/useImportDialog';
import {cleanBarcode, validBarcode} from '../barcode';
import {nutrientLabels, type ImportedProduct} from '../productImport';
import './FoodEditor.css';

const fields = [
  ['name', 'Name', 'text'], ['brand', 'Marke (optional)', 'text'],
  ['portionName', 'Portionsname (z. B. 1 Esslöffel oder 1 Becher)', 'text'],
  ['portionGrams', 'Gramm pro Portion', 'number'],
  ['pieceGrams', 'Gramm pro Stück (optional)', 'number'],
  ['sliceGrams', 'Gramm pro Scheibe (optional)', 'number'],
  ['gramsPerMl', 'Gramm pro ml / Dichte (optional)', 'number'],
] as const;
const labels = {kcal: 'Kalorien', protein: 'Eiweiß', carbs: 'Kohlenhydrate', fat: 'Fett', fiber: 'Ballaststoffe', sugar: 'Zucker'};
const referenceMode = (reference: NutritionReference) => reference.unit === 'portion' ? 'portion' : reference.unit === 'ml' ? '100ml' : reference.amount === 100 ? '100g' : 'custom';

export default function FoodEditor({food, existing, onSave, onClose, onSaveAndUse, importReview}: {
  food: Food; existing: boolean; onSave: (food: Food) => Promise<void>; onClose: () => void;
  onSaveAndUse?: (food: Food) => Promise<void>; importReview?: ImportedProduct;
}) {
  const notify = useToast();
  const [reference, setReference] = useState<NutritionReference>(food.nutritionReference ?? defaultReference);
  const [mode, setMode] = useState(referenceMode(reference));
  const [draft, setDraft] = useState(() => importReview ? {...food} : scaleNutrients(food, referenceGrams(food, reference) / 100));
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const guard = useDraftGuard('Lebensmittel', {draft, reference, mode, reviewed}, saving, 'food-editor', importReview ? true : undefined);
  const dialog = useImportDialog(() => {if (guard.confirmLeave()) onClose();});
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
    event.preventDefault();event.stopPropagation();
    if (saving) return;
    const barcode = cleanBarcode(draft.barcode ?? '');
    if (barcode && !validBarcode(barcode)) {notify('Bitte einen gültigen Barcode mit korrekter Prüfziffer eingeben oder das Feld leeren.', 'error');return;}
    if (importReview && !reviewed) {notify('Bitte die übernommenen Angaben prüfen und bestätigen.', 'error');return;}
    const result = {...normalized, barcode: barcode || undefined, nutritionReference: reference, name: draft.name.trim(), portionName: draft.portionName.trim(),
      portions: draft.portions?.map(portion => ({...portion, name: portion.name.trim()}))};
    if (!isPositive(grams) || !validFood(result)) {
      notify('Bitte Namen, eindeutige Portionsnamen, positive Gewichte und gültige Nährwerte eingeben.', 'error'); return;
    }
    setSaving(true);
    const save = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'use' && onSaveAndUse ? onSaveAndUse : onSave;
    try { await save(result); guard.markSaved(); }
    catch (e) { notify(germanError(e), 'error'); }
    finally { setSaving(false); }
  }

  return <div ref={dialog} tabIndex={-1} className="overlay" role="dialog" aria-modal="true" aria-labelledby="food-editor-title">
    <form className="modal food-editor editor" onSubmit={submit}>
      <div className="section-head"><h2 id="food-editor-title">Lebensmittel {existing ? 'bearbeiten' : 'anlegen'}</h2>
        <button type="button" className="iconbtn" aria-label="Schließen" disabled={saving} onClick={() => {if (guard.confirmLeave()) onClose();}}>×</button></div>
      {importReview && <section className="food-import-review" aria-label="Importierte Angaben prüfen">
        {importReview.warnings.map(message => <p className="hint" key={message}>{message}</p>)}
        {importReview.missing.length > 0 && <p className="hint">Nicht vorhanden oder nicht sicher erkannt: {importReview.missing.map(key => nutrientLabels[key]).join(', ')}. Bitte ergänzen; nur tatsächlich bekannte Nullwerte als 0 eintragen.</p>}
        <label><input type="checkbox" required checked={reviewed} disabled={saving} onChange={event => setReviewed(event.target.checked)}/>Ich habe Bezugsmenge und Angaben mit der Verpackung geprüft.</label>
      </section>}
      {food.source && <p className="hint food-source">Quelle: <a href={`https://world.openfoodfacts.org/product/${food.barcode ?? ''}`} target="_blank" rel="noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a>. Änderungen werden nur in deiner App gespeichert.</p>}
      <label>Barcode (optional)<input inputMode="numeric" autoComplete="off" value={draft.barcode ?? ''} disabled={saving} onChange={event => setDraft({...draft,barcode:event.target.value || undefined})}/></label>
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
        <label>Nährwerte beziehen sich auf<select aria-label="Nährwerte beziehen sich auf" value={mode} disabled={saving} onChange={event => changeMode(event.target.value)}>
          <option value="100g">100 g</option><option value="100ml">100 ml</option><option value="portion">1 Portion</option><option value="custom">Eigene Menge in g</option>
        </select></label>
        {mode === 'custom' && <label>Bezugsmenge in g<input type="number" min="0" step="any" required value={Number.isFinite(reference.amount) ? reference.amount : ''} disabled={saving} onChange={event => setReference({unit: 'g', amount: event.target.value === '' ? NaN : Number(event.target.value)})}/></label>}
        <p className="hint">{mode === 'portion' ? `Trage die Werte für 1 × ${draft.portionName} ein, zum Beispiel 116 kcal für eine Kartoffel mit 150 g.` : 'Wähle zuerst die Bezugsmenge und übertrage dann die dazugehörigen Nährwerte.'} Für ml wird die Dichte oben benötigt. Bei einer Änderung des Bezugsgewichts bleiben deine eingegebenen Zahlen erhalten.</p>
        <div className="fields">{nutrientKeys.map(key => <label key={key}>{labels[key]} / {suffix}<input type="number" min="0" step="any" required disabled={saving}
          value={Number.isFinite(draft[key]) ? draft[key] : ''} onChange={event => setDraft({...draft, [key]: event.target.value === '' ? NaN : Number(event.target.value)})}/></label>)}</div>
        {isPositive(grams) && Number.isFinite(normalized.kcal) && <p className="hint" aria-live="polite">Entspricht {fmt(normalized.kcal, 2)} kcal pro 100 g · {fmt(normalized.kcal * draft.portionGrams / 100, 2)} kcal pro Portion ({fmt(draft.portionGrams, 3)} g).</p>}
      </section>
      <div className="food-editor__save-actions"><button className={onSaveAndUse ? 'secondary wide' : 'primary wide'} disabled={saving} value="save"><Check size={17}/>{saving ? 'Wird gespeichert…' : 'Produkt speichern'}</button>
        {onSaveAndUse && <button className="primary wide" disabled={saving} value="use">Speichern und zum Tag hinzufügen</button>}</div>
    </form>
  </div>;
}
