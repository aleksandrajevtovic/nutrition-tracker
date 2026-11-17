import {BookOpen, ChevronDown} from 'lucide-react';
import type {Recipe} from '../recipes';
import {fmt} from '../nutrition';
import {entryQuantity} from '../quantityLabels';
import {revealOpeningDetails} from '../hooks/useScrollReveal';
import './RecipeDetails.css';

export default function RecipeDetails({name, recipe}: {name: string; recipe: Recipe}) {
  return <details className="recipe-details">
    <summary aria-label={`${name}: Rezept ansehen`} onClick={revealOpeningDetails}><BookOpen size={17} aria-hidden="true"/><span>Rezept ansehen</span><ChevronDown size={17} aria-hidden="true"/></summary>
    <div className="recipe-details__content">
      <p className="recipe-details__yield">Für {fmt(recipe.servings, 3)} {recipe.servings === 1 ? 'Portion' : 'Portionen'} · Fertiggewicht {fmt(recipe.yieldGrams, 3)} g</p>
      <h3>Zutaten für das gesamte Rezept</h3>
      <ul>{recipe.ingredients.map(ingredient => <li key={ingredient.id}>
        <strong>{ingredient.foodSnapshot.name}</strong>
        {ingredient.foodSnapshot.brand && <small>{ingredient.foodSnapshot.brand}</small>}
        <span>{entryQuantity(ingredient)}</span>
      </li>)}</ul>
      {recipe.instructions.trim() && <div className="recipe-details__instructions"><h3>Zubereitung & Notizen</h3><p>{recipe.instructions}</p></div>}
    </div>
  </details>;
}
