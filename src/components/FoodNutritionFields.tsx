import type {Food} from '../db';
import {fmt} from '../nutrition';
import {nutrientKeys, type NutritionReference} from '../foodValues';
import {nutrientLabels} from '../productImport';
import type {FoodFieldErrors} from '../foodEditorValidation';
import FoodFieldError, {foodFieldProps} from './FoodFieldError';

export default function FoodNutritionFields({draft,reference,mode,onMode,onReference,onChange,disabled,errors,prefix}: {
  draft: Food;reference: NutritionReference;mode: string;onMode: (mode: string) => void;
  onReference: (reference: NutritionReference) => void;onChange: (food: Food) => void;
  disabled: boolean;errors: FoodFieldErrors;prefix: string;
}) {
  const suffix = reference.unit === 'portion' ? `Portion (${fmt(draft.portionGrams,3)} g)` : `${fmt(reference.amount,3)} ${reference.unit}`;
  return <section className="food-editor__section food-editor__nutrition" aria-labelledby={`${prefix}-nutrition-title`}>
    <h3 id={`${prefix}-nutrition-title`}>Nährwerte</h3>
    <label>Nährwerte beziehen sich auf<select aria-label="Nährwerte beziehen sich auf" value={mode} disabled={disabled} onChange={event => onMode(event.target.value)}>
      <option value="100g">100 g</option><option value="100ml">100 ml</option><option value="portion">1 Portion</option><option value="custom">Eigene Menge in g</option>
    </select></label>
    {mode === 'custom' && <label>Bezugsmenge in g<input {...foodFieldProps('referenceAmount',errors,prefix)} aria-label="Bezugsmenge in g" type="number" min="0" step="any" required value={Number.isFinite(reference.amount) ? reference.amount : ''} disabled={disabled} onChange={event => onReference({unit:'g',amount:event.target.value === '' ? NaN : Number(event.target.value)})}/><FoodFieldError field="referenceAmount" errors={errors} prefix={prefix}/></label>}
    {reference.unit === 'ml' && <label>Dichte in g/ml<input {...foodFieldProps('gramsPerMl',errors,prefix)} aria-label="Gramm pro ml / Dichte (optional)" type="number" min="0" step="any" required disabled={disabled} placeholder="Dichte laut Produkt" value={draft.gramsPerMl ?? ''} onChange={event => onChange({...draft,gramsPerMl:event.target.value === '' ? undefined : Number(event.target.value)})}/><FoodFieldError field="gramsPerMl" errors={errors} prefix={prefix}/><span className="food-field-hint">Für die Umrechnung zwischen ml und g erforderlich.</span></label>}
    <p className="food-editor__basis">Alle Angaben pro {suffix}</p>
    <div className="food-editor__nutrients">{nutrientKeys.map(key => <label key={key}>{nutrientLabels[key]} <span className="food-editor__unit">{key === 'kcal' ? 'kcal' : 'g'}</span><input {...foodFieldProps(key,errors,prefix)} aria-label={`${nutrientLabels[key]} / ${suffix}`} type="number" min="0" step="any" required={key !== 'fiber'} disabled={disabled}
      value={Number.isFinite(draft[key]) ? draft[key] ?? '' : ''} onChange={event => onChange({...draft,[key]:event.target.value === '' ? NaN : Number(event.target.value)})}/><FoodFieldError field={key} errors={errors} prefix={prefix}/></label>)}</div>
    <p className="hint">{mode === 'portion' ? `Die Werte gelten für deine Standardportion „${draft.portionName}“. Gewicht und Namen kannst du unten bearbeiten.` : 'Die Werte für die gewählte Bezugsmenge von der Verpackung übernehmen.'} Ballaststoffe können leer bleiben, wenn sie nicht angegeben sind. Tatsächliche Nullwerte als 0 eingeben.</p>
  </section>;
}
