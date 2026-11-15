import {useRef, useState} from 'react';
import {Check, X} from 'lucide-react';
import type {Food} from '../db';
import {fmt} from '../nutrition';
import {buildRecipeFood, recipeTotals, validIngredient, type RecipeIngredient} from '../recipes';
import {parseWeight} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import RecipeIngredients from './RecipeIngredients';
import {useDraftGuard, useNavigationGuard} from './UnsavedChangesProvider';
import './RecipeEditor.css';

export default function RecipeEditor({food, foods, existing, onSave, onClose}: {
  food: Food; foods: Food[]; existing: boolean; onSave: (food: Food) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(food.name);
  const [servings, setServings] = useState(String(food.recipe?.servings ?? 1).replace('.', ','));
  const [finishedWeight, setFinishedWeight] = useState(food.recipe?.yieldGrams && !food.recipe.autoWeight ? String(food.recipe.yieldGrams).replace('.', ',') : '');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(food.recipe?.ingredients ?? []);
  const [instructions, setInstructions] = useState(food.recipe?.instructions ?? '');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const notify = useToast();
  const guard = useDraftGuard('Rezept', {name, servings, finishedWeight, ingredients, instructions}, busy, 'recipe-editor');
  const confirmNavigation = useNavigationGuard();
  const totals = recipeTotals(ingredients);
  const yieldGrams = finishedWeight.trim() ? parseWeight(finishedWeight) : totals.grams;
  const count = parseWeight(servings);
  const preview = ingredients.length > 0 && ingredients.every(validIngredient) && Number.isFinite(yieldGrams) && yieldGrams > 0 && Number.isFinite(count) && count > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current || !confirmNavigation(['recipe-ingredient'])) return;
    saving.current = true; setBusy(true);
    try {
      const recipe = buildRecipeFood({...food, name: name.trim()}, {servings: count, yieldGrams, autoWeight: finishedWeight.trim() === '', ingredients, instructions: instructions.trim()});
      await onSave(recipe);
      guard.markSaved();
    } catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }

  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="recipe-editor-title">
    <form className="modal recipe-editor editor" onSubmit={submit}>
      <div className="section-head"><h2 id="recipe-editor-title">Rezept {existing ? 'bearbeiten' : 'anlegen'}</h2>
        <button type="button" className="iconbtn" aria-label="Rezept schließen" disabled={busy} onClick={() => {if (confirmNavigation(['recipe-editor', 'recipe-ingredient'])) onClose();}}><X size={18}/></button></div>
      <label>Rezeptname<input required value={name} disabled={busy} onChange={event => setName(event.target.value)}/></label>
      <div className="quantity-fields"><label>Anzahl der Portionen<input type="text" inputMode="decimal" required value={servings} disabled={busy} onChange={event => setServings(event.target.value)}/></label>
        <label>Fertiges Gesamtgewicht in g (optional)<input type="text" inputMode="decimal" placeholder={Number.isFinite(totals.grams) && totals.grams > 0 ? fmt(totals.grams, 2) : 'Summe der Zutatengewichte'} value={finishedWeight} disabled={busy} onChange={event => setFinishedWeight(event.target.value)}/></label></div>
      <p className="hint">Leer lassen, um die Summe der Zutatengewichte zu verwenden. Wenn sich das Gewicht beim Kochen ändert, wiege das fertige Gericht und trage das Gesamtgewicht ein. Die Kalorien bleiben gleich; das Gewicht pro Portion wird angepasst.</p>
      <RecipeIngredients foods={foods.filter(current => current.id !== food.id)} ingredients={ingredients} disabled={busy} onChange={setIngredients}/>
      {preview && <div className="recipe-preview" aria-live="polite"><div><span>Gesamtes Rezept</span><strong>{fmt(totals.kcal)} kcal</strong><small>{fmt(yieldGrams, 2)} g · {fmt(count, 2)} Portionen</small></div>
        <div><span>Pro Portion</span><strong>{fmt(totals.kcal / count)} kcal</strong><small>{fmt(yieldGrams / count, 2)} g · Eiweiß {fmt(totals.protein / count)} g · KH {fmt(totals.carbs / count)} g · F {fmt(totals.fat / count)} g</small></div></div>}
      <label>Zubereitung / Notizen (optional)<textarea aria-label="Zubereitung / Notizen (optional)" value={instructions} disabled={busy} rows={3} onChange={event => setInstructions(event.target.value)}/></label>
      <p className="hint">Nach dem Speichern ist das Rezept in der Lebensmittelauswahl verfügbar. Mit der Einheit „Portion“ kannst du auch halbe oder mehrere Portionen eintragen. Bestehende Tagebucheinträge behalten ihre gespeicherten Nährwerte.</p>
      <button className="primary wide" disabled={busy}><Check size={17}/>{busy ? 'Wird gespeichert…' : 'Rezept speichern'}</button>
    </form>
  </div>;
}
