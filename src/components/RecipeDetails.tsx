import {BookOpen, ChevronDown} from 'lucide-react';
import {useEffect, useId, useRef, useState} from 'react';
import type {Recipe} from '../recipes';
import {fmt} from '../nutrition';
import {entryQuantity} from '../quantityLabels';
import {revealOpeningDetails} from '../hooks/useScrollReveal';
import {recipeForServings} from '../recipeScaling';
import {parseWeight} from '../weight';
import './RecipeDetails.css';

export default function RecipeDetails({name, recipe}: {name: string; recipe: Recipe}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [servings, setServings] = useState(() => String(recipe.servings).replace('.', ','));
  useEffect(() => {setServings(String(recipe.servings).replace('.', ','));}, [recipe.servings]);
  const count = parseWeight(servings), scaled = recipeForServings(recipe, count);
  return <details className="recipe-details">
    <summary aria-label={`${name}: Rezept ansehen`} onClick={revealOpeningDetails}><BookOpen size={17} aria-hidden="true"/><span>Rezept ansehen</span><ChevronDown size={17} aria-hidden="true"/></summary>
    <div className="recipe-details__content">
      <div className="recipe-details__servings"><label htmlFor={`${id}-servings`}>Portionen zum Kochen<input ref={input} id={`${id}-servings`} aria-label={`Portionen zum Kochen für ${name}`} aria-invalid={!scaled || undefined} aria-describedby={`${id}-hint${!scaled ? ` ${id}-error` : ''}`} type="text" inputMode="decimal" autoComplete="off" value={servings} onFocus={event => event.currentTarget.select()} onChange={event => setServings(event.target.value)}/></label>
        <button type="button" className="secondary" disabled={count === recipe.servings} onClick={() => {setServings(String(recipe.servings).replace('.', ','));input.current?.focus();}}>Originalmenge</button></div>
      <p className="recipe-details__hint" id={`${id}-hint`}>Gespeichert: {fmt(recipe.servings, 3)} {recipe.servings === 1 ? 'Portion' : 'Portionen'}. Änderungen gelten nur für diese Ansicht.</p>
      {!scaled && <p className="recipe-details__error" id={`${id}-error`} role="status">Bitte eine gültige Portionsanzahl größer als 0 eingeben.</p>}
      <p className="recipe-details__yield">{scaled ? `Für ${fmt(count, 3)} ${count === 1 ? 'Portion' : 'Portionen'} · Fertiggewicht ${fmt(scaled.yieldGrams, 3)} g` : 'Mengen werden nach einer gültigen Portionsanzahl angezeigt.'}</p>
      <h3>Zutaten für die gewählten Portionen</h3>
      <ul>{recipe.ingredients.map((ingredient, index) => <li key={ingredient.id}>
        <strong>{ingredient.foodSnapshot.name}</strong>
        {ingredient.foodSnapshot.brand && <small>{ingredient.foodSnapshot.brand}</small>}
        <span>{scaled ? entryQuantity(scaled.ingredients[index]) : '—'}</span>
      </li>)}</ul>
      {recipe.instructions.trim() && <div className="recipe-details__instructions"><h3>Zubereitung & Notizen</h3><p>{recipe.instructions}</p></div>}
    </div>
  </details>;
}
