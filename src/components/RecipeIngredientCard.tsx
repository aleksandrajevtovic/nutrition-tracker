import {useState} from 'react';
import {ChevronDown, Trash2} from 'lucide-react';
import {fmt, gramsPerUnit, isPositive, toGrams, unitLabels, units, type Unit} from '../nutrition';
import {validIngredient, type RecipeIngredient} from '../recipes';
import {changeIngredientUnit} from '../recipeIngredients';
import {entryQuantity, portionNameLabel} from '../quantityLabels';
import {parseWeight} from '../weight';
import PortionPicker from './PortionPicker';

export default function RecipeIngredientCard({ingredient,index,disabled,onChange,onRemove}: {
  ingredient: RecipeIngredient;index: number;disabled: boolean;onChange: (value: RecipeIngredient) => void;onRemove: () => void;
}) {
  const [expanded,setExpanded]=useState(!validIngredient(ingredient));
  const [amount,setAmount]=useState(()=>Number.isFinite(ingredient.amount) ? String(ingredient.amount).replace('.',',') : '');
  const valid=validIngredient(ingredient);
  return <div className="recipe-ingredient" data-ingredient-id={ingredient.id}>
    <details open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
      <summary><span><strong>{ingredient.foodSnapshot.name}</strong><small>{valid ? `${entryQuantity(ingredient)} · ${fmt(ingredient.foodSnapshot.kcal*ingredient.grams/100)} kcal` : 'Menge prüfen'}</small></span><ChevronDown size={17} aria-hidden="true"/></summary>
      <div className="recipe-ingredient__fields"><div className="quantity-fields">
        <label>Menge<input type="text" inputMode="decimal" aria-label={`Menge für Zutat ${index+1}`} data-recipe-invalid={!valid || undefined} aria-invalid={!valid || undefined} value={amount} disabled={disabled} onChange={event=>{
          const value=event.target.value;setAmount(value);const number=parseWeight(value);onChange({...ingredient,amount:number,grams:toGrams(ingredient.foodSnapshot,number,ingredient.unit)});
        }}/></label>
        <label>Einheit<select aria-label={`Einheit für Zutat ${index+1}`} value={ingredient.unit} disabled={disabled} onChange={event=>{
          const next=changeIngredientUnit(ingredient,event.target.value as Unit);setAmount(Number.isFinite(next.amount) ? String(next.amount).replace('.',',') : '');onChange(next);
        }}>{units.map(unit=><option key={unit} value={unit} disabled={!isPositive(gramsPerUnit(ingredient.foodSnapshot,unit))}>{unit==='portion' ? portionNameLabel(ingredient.foodSnapshot.portionName) : unitLabels[unit]}</option>)}</select></label>
      </div>
      {ingredient.unit==='portion' && <PortionPicker food={ingredient.foodSnapshot} disabled={disabled} label={`Portionsgröße für Zutat ${index+1}`} onChange={food=>onChange({...ingredient,foodSnapshot:food,grams:toGrams(food,ingredient.amount,ingredient.unit)})}/>}
      {!valid && <p className="recipe-field-error">Bitte eine gültige Menge größer als 0 eingeben.</p>}
      {valid && <p className="hint">{entryQuantity(ingredient)} · Eiweiß {fmt(ingredient.foodSnapshot.protein*ingredient.grams/100)} g</p>}
      </div>
    </details>
    <button type="button" className="iconbtn recipe-ingredient__remove" disabled={disabled} aria-label={`${ingredient.foodSnapshot.name} als Zutat entfernen`} onClick={onRemove}><Trash2 size={17}/></button>
  </div>;
}
