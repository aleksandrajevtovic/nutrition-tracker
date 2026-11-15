import {useState} from 'react';
import {CookingPot, Pencil, Star, Trash2} from 'lucide-react';
import type {Food} from '../db';
import {fmt} from '../nutrition';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import './FoodCard.css';

export default function FoodCard({food, onEdit, onDelete, onFavorite}: {
  food: Food; onEdit: (food: Food) => void; onDelete: (food: Food) => void; onFavorite: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  async function toggleFavorite() {
    if (busy) return;
    setBusy(true);
    try {await onFavorite(food.id);} catch (error) {notify(germanError(error), 'error');}
    finally {setBusy(false);}
  }

  return <article className="food panel">
    <div className="food__header"><div><strong>{food.name}</strong>
      <small>{food.brand && `${food.brand} · `}{food.portionName} = {fmt(food.portionGrams, 3)} g</small>
      {food.recipe && <span className="food__recipe-tag"><CookingPot size={13}/>Rezept · {fmt(food.recipe.servings, 2)} Portionen</span>}</div>
      <button type="button" className="food__favorite" aria-pressed={food.favorite === true} disabled={busy}
        aria-label={food.favorite ? `${food.name} aus Favoriten entfernen` : `${food.name} als Favorit markieren`}
        title={food.favorite ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'} onClick={toggleFavorite}>
        <Star size={19} fill={food.favorite ? 'currentColor' : 'none'}/>
      </button>
    </div>
    <div className="food__facts">{food.recipe && <small><b>{Math.round(food.kcal * food.portionGrams / 100)} kcal pro Portion</b></small>}
      <small>{fmt(food.kcal)} kcal · P {fmt(food.protein)} g · KH {fmt(food.carbs)} g · F {fmt(food.fat)} g / 100 g</small>
      {Boolean(food.portions?.length) && <small>{food.portions?.map(portion => `${portion.name} = ${fmt(portion.grams, 3)} g`).join(' · ')}</small>}
      <small>{[
        food.pieceGrams ? `1 Stück = ${fmt(food.pieceGrams, 3)} g` : '',
        food.sliceGrams ? `1 Scheibe = ${fmt(food.sliceGrams, 3)} g` : '',
        food.gramsPerMl ? `1 ml = ${fmt(food.gramsPerMl, 3)} g` : '',
      ].filter(Boolean).join(' · ')}</small>
    </div>
    <div className="actions">
      <button type="button" onClick={() => onEdit({...food})} title="Bearbeiten" aria-label={`${food.name} bearbeiten`}><Pencil size={17}/></button>
      <button type="button" onClick={() => onDelete(food)} title="Löschen" aria-label={`${food.name} löschen`}><Trash2 size={17}/></button>
    </div>
  </article>;
}
