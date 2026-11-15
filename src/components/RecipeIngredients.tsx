import {useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import type {Food} from '../db';
import {fmt, gramsPerUnit, isPositive, toGrams, unitLabels, units, type Unit} from '../nutrition';
import {makeIngredient, type RecipeIngredient} from '../recipes';
import FoodPicker from './FoodPicker';
import PortionPicker from './PortionPicker';
import {useToast} from './ToastProvider';

export default function RecipeIngredients({foods, ingredients, disabled, onChange}: {
  foods: Food[]; ingredients: RecipeIngredient[]; disabled: boolean; onChange: (ingredients: RecipeIngredient[]) => void;
}) {
  const [selected, setSelected] = useState<Food>();
  const [amount, setAmount] = useState('100');
  const [unit, setUnit] = useState<Unit>('g');
  const notify = useToast();

  function add() {
    if (disabled) return;
    const quantity = Number(amount);
    if (!selected || !isPositive(quantity) || !isPositive(toGrams(selected, quantity, unit))) {
      notify('Bitte eine Zutat und eine gültige positive Menge wählen.', 'error'); return;
    }
    onChange([...ingredients, makeIngredient(selected, quantity, unit)]);
    setSelected(undefined); setAmount('100'); setUnit('g');
  }
  function update(ingredient: RecipeIngredient, nextAmount: number, nextUnit: Unit) {
    onChange(ingredients.map(current => current.id === ingredient.id ? {...current, amount: nextAmount, unit: nextUnit,
      grams: toGrams(current.foodSnapshot, nextAmount, nextUnit)} : current));
  }

  return <section className="recipe-ingredients" aria-labelledby="recipe-ingredients-title">
    <h3 id="recipe-ingredients-title">Zutaten</h3>
    <div className="recipe-ingredient-list">{ingredients.map((ingredient, index) => <div className="recipe-ingredient" key={ingredient.id}>
      <div className="recipe-ingredient__heading"><strong>{ingredient.foodSnapshot.name}</strong>
        <button type="button" className="iconbtn" disabled={disabled} aria-label={`${ingredient.foodSnapshot.name} als Zutat entfernen`} onClick={() => onChange(ingredients.filter(current => current.id !== ingredient.id))}><Trash2 size={17}/></button></div>
      <div className="quantity-fields"><label>Menge<input type="number" step="any" min="0" aria-label={`Menge für Zutat ${index + 1}`} value={Number.isFinite(ingredient.amount) ? ingredient.amount : ''} disabled={disabled}
        onChange={event => update(ingredient, event.target.value === '' ? NaN : Number(event.target.value), ingredient.unit)}/></label>
        <label>Einheit<select value={ingredient.unit} aria-label={`Einheit für Zutat ${index + 1}`} disabled={disabled} onChange={event => update(ingredient, ingredient.amount, event.target.value as Unit)}>
          {units.map(value => <option key={value} value={value} disabled={!isPositive(gramsPerUnit(ingredient.foodSnapshot, value))}>{value === 'portion' ? ingredient.foodSnapshot.portionName : unitLabels[value]}</option>)}
        </select></label></div>
      {ingredient.unit === 'portion' && <PortionPicker food={ingredient.foodSnapshot} disabled={disabled} label={`Portionsgröße für Zutat ${index + 1}`} onChange={food => onChange(ingredients.map(current => current.id === ingredient.id ? {...current, foodSnapshot: food, grams: toGrams(food, current.amount, current.unit)} : current))}/>}
      {isPositive(ingredient.grams) && <p className="hint">{fmt(ingredient.grams, 2)} g · {fmt(ingredient.foodSnapshot.kcal / 100 * ingredient.grams)} kcal</p>}
    </div>)}</div>
    <div className="recipe-add editor">
      <FoodPicker foods={foods} selected={selected} onChange={food => {if (!disabled) {setSelected(food); setUnit('g');}}}/>
      <div className="quantity-fields"><label>Menge<input type="number" min="0" step="any" aria-label="Menge der neuen Zutat" value={amount} disabled={disabled} onChange={event => setAmount(event.target.value)}
        onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); add();}}}/></label>
        <label>Einheit<select value={unit} aria-label="Einheit der neuen Zutat" disabled={disabled} onChange={event => setUnit(event.target.value as Unit)}>
          {units.map(value => <option key={value} value={value} disabled={selected ? !isPositive(gramsPerUnit(selected, value)) : value !== 'g'}>
            {value === 'portion' && selected ? selected.portionName : unitLabels[value]}
          </option>)}
        </select></label></div>
      {selected && unit === 'portion' && <PortionPicker food={selected} onChange={setSelected} disabled={disabled}/>}
      <button type="button" className="secondary wide" disabled={disabled || !selected} onClick={add}><Plus size={17}/>Zutat hinzufügen</button>
      <p className="hint">Für ml, Stück und Scheibe müssen die passenden Umrechnungsgewichte im Produkt hinterlegt sein. Die Nährwerte einer Zutat werden beim Hinzufügen übernommen.</p>
    </div>
  </section>;
}
