import {useId, useRef, useState} from 'react';
import {Check, ChevronDown} from 'lucide-react';
import type {Food} from '../db';
import {germanError} from '../german';
import {fmt, isPositive, validFood} from '../nutrition';
import {defaultReference, initialFoodEditorDraft, referenceGrams, scaleNutrients, type NutritionReference} from '../foodValues';
import {foodEditorErrors} from '../foodEditorValidation';
import {cleanBarcode} from '../barcode';
import {nutrientLabels, type ImportedProduct} from '../productImport';
import {useImportDialog} from '../hooks/useImportDialog';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';
import FoodPortions, {PortionNameSuggestions} from './FoodPortions';
import FoodNutritionFields from './FoodNutritionFields';
import FoodFieldError, {foodFieldProps} from './FoodFieldError';
import './FoodEditor.css';

const referenceMode = (reference: NutritionReference) => reference.unit === 'portion' ? 'portion' : reference.unit === 'ml' ? '100ml' : reference.amount === 100 ? '100g' : 'custom';

export default function FoodEditor({food,existing,onSave,onClose,onSaveAndUse,importReview}: {
  food: Food;existing: boolean;onSave: (food: Food) => Promise<void>;onClose: () => void;
  onSaveAndUse?: (food: Food) => Promise<void>;importReview?: ImportedProduct;
}) {
  const prefix = useId();const notify = useToast();
  const [reference,setReference] = useState<NutritionReference>(food.nutritionReference ?? defaultReference);
  const [mode,setMode] = useState(referenceMode(reference));
  const [draft,setDraft] = useState(() => initialFoodEditorDraft(food,existing,Boolean(importReview)));
  const [reviewed,setReviewed] = useState(false);
  const [saving,setSaving] = useState(false);
  const running = useRef(false);
  const [attempted,setAttempted] = useState(false);
  const [standardOpen,setStandardOpen] = useState(mode === 'portion');
  const [unitsOpen,setUnitsOpen] = useState(food.pieceGrams !== undefined || food.sliceGrams !== undefined || reference.unit !== 'ml' && food.gramsPerMl !== undefined);
  const guard = useDraftGuard('Lebensmittel',{draft,reference,mode,reviewed},saving,'food-editor',importReview ? true : undefined);
  const dialog = useImportDialog(() => {if (guard.confirmLeave()) onClose();});
  const grams = referenceGrams(draft,reference);
  const normalized = scaleNutrients(draft,100/grams);
  const errors = attempted ? foodEditorErrors(draft,reference,Boolean(importReview),reviewed) : {};

  function changeMode(nextMode: string) {
    const next: NutritionReference = nextMode === 'portion' ? {unit:'portion',amount:1} : nextMode === '100ml' ? {unit:'ml',amount:100} : {unit:'g',amount:nextMode === 'custom' ? draft.portionGrams : 100};
    const nextGrams = referenceGrams(draft,next);
    if (isPositive(grams) && isPositive(nextGrams)) setDraft(scaleNutrients(draft,nextGrams/grams));
    if (nextMode === 'portion') setStandardOpen(true);
    setReference(next);setMode(nextMode);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();event.stopPropagation();if (running.current) return;
    const form = event.currentTarget;
    const nextErrors = foodEditorErrors(draft,reference,Boolean(importReview),reviewed);
    setAttempted(true);
    if (Object.keys(nextErrors).length) {
      notify('Bitte die markierten Angaben ergänzen oder korrigieren.','error');
      window.requestAnimationFrame(() => {
        const field = [...form.querySelectorAll<HTMLInputElement>('[data-field]')].find(input => nextErrors[input.dataset.field!]);
        if (!field) return;
        for (let ancestor=field.parentElement;ancestor && ancestor!==form;ancestor=ancestor.parentElement) if (ancestor instanceof HTMLDetailsElement) ancestor.open=true;
        field.focus({preventScroll:true});field.scrollIntoView({block:'center',behavior:'instant'});
      });return;
    }
    const result = {...normalized,fiber: draft.fiber === null || Number.isNaN(draft.fiber) ? null : normalized.fiber,barcode:cleanBarcode(draft.barcode ?? '') || undefined,nutritionReference:reference,name:draft.name.trim(),portionName:draft.portionName.trim(),
      portions:draft.portions?.map(portion => ({...portion,name:portion.name.trim()}))};
    if (!isPositive(grams) || !validFood(result)) {notify('Bitte Namen, eindeutige Portionsnamen, positive Gewichte und gültige Nährwerte eingeben.','error');return;}
    running.current=true;setSaving(true);
    const save = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'use' && onSaveAndUse ? onSaveAndUse : onSave;
    try {await save(result);guard.markSaved();}catch(error){notify(germanError(error),'error');}finally{running.current=false;setSaving(false);}
  }

  return <div ref={dialog} tabIndex={-1} className="overlay" role="dialog" aria-modal="true" aria-labelledby={`${prefix}-title`}>
    <form className="modal food-editor editor" noValidate onSubmit={submit} onFocusCapture={event => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.type === 'number') input.select();
    }}>
      <div className="food-editor__header"><h2 id={`${prefix}-title`}>Lebensmittel {existing ? 'bearbeiten' : 'anlegen'}</h2><button type="button" className="iconbtn" aria-label="Schließen" disabled={saving} onClick={() => {if(guard.confirmLeave())onClose();}}>×</button></div>
      <div className="food-editor__body">
        <section className="food-editor__section food-editor__product" aria-labelledby={`${prefix}-product-title`}><h3 id={`${prefix}-product-title`}>Produkt</h3>
          <div className="food-editor__product-fields"><label>Name<input {...foodFieldProps('name',errors,prefix)} aria-label="Name" autoComplete="off" required placeholder="z. B. Naturjoghurt" disabled={saving} value={draft.name} onChange={event => setDraft({...draft,name:event.target.value})}/><FoodFieldError field="name" errors={errors} prefix={prefix}/></label>
            <label>Marke <span className="food-editor__optional">optional</span><input aria-label="Marke (optional)" disabled={saving} value={draft.brand} onChange={event => setDraft({...draft,brand:event.target.value})}/></label></div>
        </section>
        <FoodNutritionFields draft={draft} reference={reference} mode={mode} onMode={changeMode} onReference={setReference} onChange={setDraft} disabled={saving} errors={errors} prefix={prefix}/>
        <section className="food-editor__section" aria-labelledby={`${prefix}-portions-title`}><h3 id={`${prefix}-portions-title`}>Portionen</h3>
          <details className="food-standard-portion food-portions__card" open={standardOpen} onToggle={event => setStandardOpen(event.currentTarget.open)}>
            <summary><span><small>Standardportion</small><strong>{draft.portionName.trim() || 'Portionsname ergänzen'} · {isPositive(draft.portionGrams) ? `${fmt(draft.portionGrams,3)} g` : 'Gewicht ergänzen'}</strong></span><ChevronDown size={17} aria-hidden="true"/></summary>
            <div className="food-portions__content"><div className="food-portions__fields">
              <label>Portionsname<input {...foodFieldProps('portionName',errors,prefix)} aria-label="Portionsname" required disabled={saving} value={draft.portionName} onChange={event => setDraft({...draft,portionName:event.target.value})}/><FoodFieldError field="portionName" errors={errors} prefix={prefix}/></label>
              <label>Gewicht <span className="food-editor__unit">g</span><input {...foodFieldProps('portionGrams',errors,prefix)} aria-label="Gramm pro Portion" type="number" min="0" step="any" required disabled={saving} value={Number.isFinite(draft.portionGrams) ? draft.portionGrams : ''} onChange={event => setDraft({...draft,portionGrams:event.target.value === '' ? NaN : Number(event.target.value)})}/><FoodFieldError field="portionGrams" errors={errors} prefix={prefix}/></label>
            </div><PortionNameSuggestions value={draft.portionName} disabled={saving} onSelect={portionName => setDraft({...draft,portionName})}/></div>
          </details>
          <FoodPortions portions={draft.portions ?? []} onChange={portions => setDraft({...draft,portions})} disabled={saving} errors={errors} prefix={prefix}/>
        </section>
        <section className="food-editor__section food-editor__extras" aria-label="Zusatzangaben">
          <details className="food-editor__details" open={unitsOpen} onToggle={event => setUnitsOpen(event.currentTarget.open)}>
            <summary>Weitere Einheiten<ChevronDown size={17} aria-hidden="true"/></summary>
            <p className="hint">Nur nötig, wenn du das Lebensmittel in Stück, Scheiben oder ml eintragen möchtest.</p>
            <div className="food-editor__conversion-fields">{([['pieceGrams','Gramm pro Stück (optional)'],['sliceGrams','Gramm pro Scheibe (optional)'],...(reference.unit === 'ml' ? [] : [['gramsPerMl','Gramm pro ml / Dichte (optional)']])] as [keyof Pick<Food,'pieceGrams'|'sliceGrams'|'gramsPerMl'>,string][]).map(([key,label]) => <label key={key}>{label}<input {...foodFieldProps(key,errors,prefix)} aria-label={label} type="number" min="0" step="any" disabled={saving} value={draft[key] ?? ''} onChange={event => setDraft({...draft,[key]:event.target.value === '' ? undefined : Number(event.target.value)})}/><FoodFieldError field={key} errors={errors} prefix={prefix}/></label>)}</div>
          </details>
          <details className="food-editor__details"><summary>Weitere Angaben<span className="food-editor__optional">Barcode</span><ChevronDown size={17} aria-hidden="true"/></summary>
            <label>Barcode <span className="food-editor__optional">optional</span><input {...foodFieldProps('barcode',errors,prefix)} aria-label="Barcode (optional)" inputMode="numeric" autoComplete="off" disabled={saving} value={draft.barcode ?? ''} onChange={event => setDraft({...draft,barcode:event.target.value || undefined})}/><FoodFieldError field="barcode" errors={errors} prefix={prefix}/></label>
          </details>
        </section>
        {importReview && <section className="food-import-review" aria-label="Importierte Angaben prüfen"><h3>Übernommene Angaben prüfen</h3>
          {importReview.warnings.map(message => <p className="hint" key={message}>{message}</p>)}
          {importReview.missing.length > 0 && <p className="hint">Fehlende Angaben: {importReview.missing.map(key => nutrientLabels[key]).join(', ')}. Bitte ergänzen, soweit angegeben; Ballaststoffe sind optional. Fehlende Angaben wurden nicht als 0 übernommen.</p>}
          <label><input {...foodFieldProps('reviewed',errors,prefix)} type="checkbox" required checked={reviewed} disabled={saving} onChange={event => setReviewed(event.target.checked)}/>Ich habe Bezugsmenge und Angaben mit der Verpackung geprüft.</label><FoodFieldError field="reviewed" errors={errors} prefix={prefix}/>
        </section>}
        {food.source && <p className="hint food-source">Quelle: <a href={`https://world.openfoodfacts.org/product/${food.barcode ?? ''}`} target="_blank" rel="noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a>. Änderungen werden nur in deiner App gespeichert.</p>}
      </div>
      <div className="food-editor__footer">
        {isPositive(grams) && Number.isFinite(normalized.kcal) && isPositive(draft.portionGrams) && <p className="hint food-editor__preview" aria-live="polite">{fmt(normalized.kcal*draft.portionGrams/100,2)} kcal pro Portion · {fmt(draft.portionGrams,3)} g</p>}
        <div className="food-editor__save-actions"><button className={onSaveAndUse ? 'secondary wide' : 'primary wide'} disabled={saving} value="save"><Check size={17}/>{saving ? 'Wird gespeichert…' : 'Produkt speichern'}</button>{onSaveAndUse && <button className="primary wide" disabled={saving} value="use">Speichern und zum Tag hinzufügen</button>}</div>
      </div>
    </form>
  </div>;
}
