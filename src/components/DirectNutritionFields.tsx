import {useId, useRef} from 'react';
import {useDraftState} from './DraftRecoveryProvider';
import {directDraftErrors, directNutrients, type DirectDraft} from '../directNutrition';
const labels = {kcal:'Kalorien', protein:'Eiweiß', carbs:'Kohlenhydrate', sugar:'Zucker', fat:'Fett', fiber:'Ballaststoffe'};
const unitOptions = ['Stück', 'Portion', 'Scheibe', 'Becher', 'Teller', 'Schüssel', 'Glas'];
export default function DirectNutritionFields({draft, onChange, busy, attempted}: {draft: DirectDraft; onChange: (draft: DirectDraft) => void; busy: boolean; attempted: boolean}) {
  const id = useId(), errors = attempted ? directDraftErrors(draft) : {};
  const [customUnit, setCustomUnit] = useDraftState('DirectNutritionFields:customUnit', !unitOptions.includes(draft.unitLabel));
  const [customLabel, setCustomLabel] = useDraftState('DirectNutritionFields:customLabel', unitOptions.includes(draft.unitLabel) ? '' : draft.unitLabel);
  const customInput = useRef<HTMLInputElement>(null);
  const field = (key: keyof DirectDraft, label: string, decimal = false) => <label htmlFor={`${id}-${key}`}>{label}<input id={`${id}-${key}`} data-entry-nutrient={key} aria-label={label} type="text" inputMode={decimal ? 'decimal' : undefined} value={String(draft[key])} disabled={busy}
    aria-invalid={Boolean(errors[key]) || undefined} aria-describedby={errors[key] ? `${id}-${key}-error` : undefined} onChange={event => onChange({...draft, [key]:event.target.value})}/>{errors[key] && <span id={`${id}-${key}-error`} className="direct-nutrition__error">{errors[key]}</span>}</label>;
  return <section className="direct-nutrition" aria-label="Nährwerte direkt eingeben">
    {field('name', 'Bezeichnung')}
    <div className="quantity-fields">{field('amount', 'Menge', true)}<label htmlFor={`${id}-unit`}>Einheit<select id={`${id}-unit`} aria-label="Einheit der Menge" value={customUnit ? 'custom' : draft.unitLabel} disabled={busy} onChange={event => {
      const custom = event.target.value === 'custom';setCustomUnit(custom);
      onChange({...draft, unitLabel:custom ? customLabel : event.target.value});
      if (custom) window.requestAnimationFrame(() => customInput.current?.focus());
    }}>{unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}<option value="custom">Eigene Einheit …</option></select></label></div>
    {customUnit && <label htmlFor={`${id}-custom-unit`}>Eigene Einheit<input ref={customInput} id={`${id}-custom-unit`} aria-label="Eigene Einheit" value={draft.unitLabel} placeholder="z. B. Handvoll oder Packung" disabled={busy}
      aria-invalid={Boolean(errors.unitLabel) || undefined} aria-describedby={errors.unitLabel ? `${id}-unit-error` : undefined} onChange={event => {setCustomLabel(event.target.value);onChange({...draft, unitLabel:event.target.value});}}/>
      {errors.unitLabel && <span id={`${id}-unit-error`} className="direct-nutrition__error">{errors.unitLabel}</span>}</label>}
    <p className="hint direct-nutrition__reference">Alle Nährwerte gelten für die gesamte angegebene Menge, z. B. eine ganze Brezel. Keine Umrechnung auf 100 g nötig.</p>
    {field('kcal', 'Kalorien (kcal)', true)}
    <fieldset className="direct-nutrition__optional"><legend>Weitere Nährwerte <small>optional</small></legend><div className="quantity-fields">{directNutrients.filter(key => key !== 'kcal').map(key => <div key={key}>{field(key, `${labels[key]} (g)`, true)}</div>)}</div></fieldset>
    {field('weight', 'Gewicht der gesamten Menge in g (optional)', true)}
    <label className="direct-nutrition__estimated"><input type="checkbox" checked={draft.estimated} disabled={busy} onChange={event => onChange({...draft, estimated:event.target.checked})}/><span>Geschätzte Werte<small>Zum Beispiel aus einer Fotoauswertung oder einer eigenen Schätzung.</small></span></label>
  </section>;
}
