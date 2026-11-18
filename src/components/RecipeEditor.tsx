import {useDraftState} from './DraftRecoveryProvider';
import {useId, useRef, useState} from 'react';
import {Check, ChevronDown, X} from 'lucide-react';
import type {Food} from '../db';
import {emptyFood, fiberIncomplete, fmt, isPositive} from '../nutrition';
import {buildRecipeFood, recipeTotals, validIngredient, type RecipeIngredient} from '../recipes';
import {parseWeight} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import RecipeIngredients from './RecipeIngredients';
import FoodEditor from './FoodEditor';
import {useDraftGuard, useNavigationGuard} from './UnsavedChangesProvider';
import {useImportDialog} from '../hooks/useImportDialog';
import './RecipeEditor.css';

export default function RecipeEditor({food,foods,existing,onSave,onClose,copySource,onSaveFood}: {
  food: Food;foods: Food[];existing: boolean;onSave: (food: Food) => Promise<void>;onClose: () => void;
  copySource?: string;
  onSaveFood: (food: Food) => Promise<void>;
}) {
  const id=useId();
  const [name,setName]=useDraftState(`RecipeEditor:${food.id}:name`, food.name);
  const [servings,setServings]=useDraftState(`RecipeEditor:${food.id}:servings`, String(food.recipe?.servings ?? 1).replace('.',','));
  const [finishedWeight,setFinishedWeight]=useDraftState(`RecipeEditor:${food.id}:finishedWeight`, food.recipe?.yieldGrams && !food.recipe.autoWeight ? String(food.recipe.yieldGrams).replace('.',',') : '');
  const [ingredients,setIngredients]=useDraftState<RecipeIngredient[]>(`RecipeEditor:${food.id}:ingredients`, food.recipe?.ingredients ?? []);
  const [instructions,setInstructions]=useDraftState(`RecipeEditor:${food.id}:instructions`, food.recipe?.instructions ?? '');
  const [creatingFood,setCreatingFood]=useDraftState<Food | null>(`RecipeEditor:${food.id}:creatingFood`, null);
  const [createdFood,setCreatedFood]=useState<Food>();
  const [weightOpen,setWeightOpen]=useDraftState(`RecipeEditor:${food.id}:weightOpen`, Boolean(finishedWeight));
  const [notesOpen,setNotesOpen]=useDraftState(`RecipeEditor:${food.id}:notesOpen`, Boolean(instructions));
  const [pending,setPending]=useState(false),[attempted,setAttempted]=useState(false),[busy,setBusy]=useState(false);
  const saving=useRef(false),form=useRef<HTMLFormElement>(null);
  const notify=useToast(),confirmNavigation=useNavigationGuard();
  const guard=useDraftGuard('Rezept',{name,servings,finishedWeight,ingredients,instructions},busy,'recipe-editor');
  const close=()=>{if(confirmNavigation(['recipe-editor','recipe-ingredient']))onClose();};
  const dialog=useImportDialog(close,!creatingFood);
  const totals=recipeTotals(ingredients),count=parseWeight(servings);
  const yieldGrams=finishedWeight.trim() ? parseWeight(finishedWeight) : totals.grams;
  const validIngredients=ingredients.length>0 && ingredients.every(validIngredient);
  const preview=validIngredients && isPositive(yieldGrams) && isPositive(count);
  const errors={name:attempted && !name.trim() ? 'Bitte einen Rezeptnamen eingeben.' : '',servings:attempted && !isPositive(count) ? 'Bitte eine Portionsanzahl größer als 0 eingeben.' : '',
    weight:attempted && finishedWeight.trim() && !isPositive(yieldGrams) ? 'Bitte ein Gesamtgewicht größer als 0 eingeben oder das Feld leeren.' : ''};
  const ingredientError=attempted ? pending ? 'Bitte die ausgewählte Zutat zuerst hinzufügen oder verwerfen.' : !ingredients.length ? 'Bitte mindestens eine Zutat hinzufügen.' : !validIngredients ? 'Bitte die markierten Zutatenmengen prüfen.' : undefined : undefined;

  async function submit(event: React.FormEvent<HTMLFormElement>){
    event.preventDefault();event.stopPropagation();if(saving.current || creatingFood)return;setAttempted(true);
    if(!name.trim() || !isPositive(count) || !preview || pending){
      notify('Bitte die markierten Angaben prüfen.','error');
      window.requestAnimationFrame(()=>{
        const root=form.current;let target: HTMLElement | null | undefined;
        if(!name.trim())target=root?.querySelector('[data-recipe-name]');
        else if(!isPositive(count))target=root?.querySelector('[data-recipe-servings]');
        else if(pending || !ingredients.length)target=root?.querySelector('[data-recipe-composer] input[aria-label="Menge der neuen Zutat"]') ?? root?.querySelector('[data-recipe-composer] .food-picker__trigger');
        else if(!validIngredients)target=root?.querySelector('[data-recipe-invalid="true"]');
        else target=root?.querySelector('[data-recipe-weight]');
        if(!target)return;
        for(let parent=target.parentElement;parent && parent!==root;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
        target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'instant'});
      });return;
    }
    saving.current=true;setBusy(true);
    try{
      const recipe=buildRecipeFood({...food,name:name.trim()},{servings:count,yieldGrams,autoWeight:finishedWeight.trim()==='',ingredients,instructions:instructions.trim()});
      await onSave(recipe);guard.markSaved();
    }catch(error){notify(germanError(error),'error');}
    finally{saving.current=false;setBusy(false);}
  }
  return <><div ref={dialog} tabIndex={-1} className="overlay" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} inert={Boolean(creatingFood)} style={creatingFood ? {display:'none'} : undefined}>
    <form ref={form} className="modal recipe-editor editor" noValidate onSubmit={submit} onFocusCapture={event=>{const input=event.target;if(input instanceof HTMLInputElement && input.inputMode==='decimal')input.select();}}>
      <div className="recipe-editor__header"><h2 id={`${id}-title`}>{copySource ? 'Rezept als Kopie bearbeiten' : `Rezept ${existing ? 'bearbeiten' : 'anlegen'}`}</h2><button type="button" className="iconbtn" aria-label="Rezept schließen" disabled={busy} onClick={close}><X size={18}/></button></div>
      <div className="recipe-editor__body">
        {copySource && <p className="hint">Kopie von „{copySource}“. Das Original bleibt erhalten.</p>}
        <section className="recipe-editor__basics"><label>Rezeptname<input data-recipe-name aria-label="Rezeptname" aria-invalid={Boolean(errors.name) || undefined} aria-describedby={errors.name ? `${id}-name-error` : undefined} required placeholder="z. B. Gemüsepfanne" disabled={busy} value={name} onChange={event=>setName(event.target.value)}/>{errors.name && <span className="recipe-field-error" id={`${id}-name-error`}>{errors.name}</span>}</label>
          <label>Portionen<input data-recipe-servings aria-label="Anzahl der Portionen" aria-invalid={Boolean(errors.servings) || undefined} aria-describedby={errors.servings ? `${id}-servings-error` : undefined} type="text" inputMode="decimal" required disabled={busy} value={servings} onChange={event=>setServings(event.target.value)}/>{errors.servings && <span className="recipe-field-error" id={`${id}-servings-error`}>{errors.servings}</span>}</label></section>
        <RecipeIngredients foods={foods.filter(current=>current.id!==food.id)} ingredients={ingredients} disabled={busy} onChange={setIngredients} onPendingChange={setPending} error={ingredientError}
          onCreateFood={name=>setCreatingFood({...emptyFood(),name})} createdFood={createdFood}/>
        {fiberIncomplete(ingredients) && <p className="hint">Ballaststoffe sind nicht für alle Zutaten angegeben. Der Ballaststoffwert des Rezepts ist unvollständig.</p>}
        <details className="recipe-editor__details" open={weightOpen} onToggle={event=>setWeightOpen(event.currentTarget.open)}><summary><span>Fertiges Gesamtgewicht<small>{finishedWeight.trim() ? isPositive(yieldGrams) ? `${fmt(yieldGrams,2)} g` : 'Gewicht prüfen' : `Automatisch${isPositive(totals.grams) ? ` · ${fmt(totals.grams,2)} g` : ''}`}</small></span><ChevronDown size={17} aria-hidden="true"/></summary>
          <label>Fertiges Gesamtgewicht in g <span className="recipe-editor__optional">optional</span><input data-recipe-weight aria-label="Fertiges Gesamtgewicht in g (optional)" aria-invalid={Boolean(errors.weight) || undefined} aria-describedby={`${id}-weight-hint${errors.weight ? ` ${id}-weight-error` : ''}`} type="text" inputMode="decimal" disabled={busy} placeholder={isPositive(totals.grams) ? fmt(totals.grams,2) : 'Summe der Zutatengewichte'} value={finishedWeight} onChange={event=>setFinishedWeight(event.target.value)}/>{errors.weight && <span className="recipe-field-error" id={`${id}-weight-error`}>{errors.weight}</span>}</label>
          <p className="hint" id={`${id}-weight-hint`}>Leer lassen für die Summe der Zutatengewichte. Bei Wasserverlust oder -aufnahme das gewogene fertige Gericht eintragen. Die Gesamtkalorien bleiben gleich.</p>
          {finishedWeight && <button type="button" className="secondary" disabled={busy} onClick={()=>setFinishedWeight('')}>Automatisches Gewicht verwenden</button>}
        </details>
        <details className="recipe-editor__details" open={notesOpen} onToggle={event=>setNotesOpen(event.currentTarget.open)}><summary><span>Zubereitung & Notizen<small>{instructions.trim() ? 'Notizen vorhanden' : 'Bei Bedarf ergänzen'}</small></span><ChevronDown size={17} aria-hidden="true"/></summary>
          <label>Zubereitung / Notizen<textarea aria-label="Zubereitung / Notizen (optional)" value={instructions} disabled={busy} rows={4} onChange={event=>setInstructions(event.target.value)}/></label>
        </details>
        {preview && <div className="recipe-preview"><div><span>Gesamtes Rezept</span><strong>{fmt(totals.kcal)} kcal</strong><small>{fmt(yieldGrams,2)} g · {fmt(count,2)} {count===1 ? 'Portion' : 'Portionen'}</small></div><div><span>Pro Portion</span><strong>{fmt(totals.kcal/count)} kcal</strong><small>Eiweiß {fmt(totals.protein/count)} g · KH {fmt(totals.carbs/count)} g · F {fmt(totals.fat/count)} g</small></div></div>}
      </div>
      <div className="recipe-editor__footer">{preview && <p className="recipe-editor__summary" aria-live="polite"><strong>{fmt(totals.kcal/count)} kcal</strong> pro Portion · {fmt(yieldGrams/count,2)} g</p>}
        <button className="primary wide" disabled={busy}><Check size={17}/>{busy ? 'Wird gespeichert…' : copySource ? 'Kopie speichern' : 'Rezept speichern'}</button>
      </div>
    </form>
  </div>
    {creatingFood && <FoodEditor key={creatingFood.id} food={creatingFood} existing={false} saveLabel="Speichern und zum Rezept" description="Dein Rezept bleibt erhalten. Nach dem Speichern wählst du die Menge dieser Zutat."
      onClose={()=>{
        setCreatingFood(null);
        window.requestAnimationFrame(()=>form.current?.querySelector<HTMLButtonElement>('.food-picker__trigger')?.focus());
      }} onSave={async created=>{
        await onSaveFood(created);setCreatedFood(created);setCreatingFood(null);
      }}/>}
  </>;
}
