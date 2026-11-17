import {useEffect, useRef, useState} from 'react';
import {Plus, X} from 'lucide-react';
import type {Food} from '../db';
import {fmt, gramsPerUnit, isPositive, toGrams, unitLabels, units, type Unit} from '../nutrition';
import {makeIngredient, type RecipeIngredient} from '../recipes';
import {parseWeight} from '../weight';
import {entryQuantity, portionNameLabel} from '../quantityLabels';
import FoodPicker from './FoodPicker';
import PortionPicker from './PortionPicker';
import RecipeIngredientCard from './RecipeIngredientCard';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';

export default function RecipeIngredients({foods,ingredients,disabled,onChange,onPendingChange,error,onCreateFood,createdFood}: {
  foods: Food[];ingredients: RecipeIngredient[];disabled: boolean;onChange: (ingredients: RecipeIngredient[]) => void;
  onPendingChange: (pending: boolean) => void;error?: string;
  onCreateFood: (name: string) => void;createdFood?: Food;
}) {
  const [selected,setSelected]=useState<Food>();
  const [amount,setAmount]=useState('');
  const [unit,setUnit]=useState<Unit>('g');
  const [lastAdded,setLastAdded]=useState('');
  const amountInput=useRef<HTMLInputElement>(null),composer=useRef<HTMLDivElement>(null);
  const notify=useToast();
  const pending=Boolean(selected || amount || unit!=='g');
  useDraftGuard('Noch nicht hinzugefügte Rezeptzutat',{selected,amount,unit},false,'recipe-ingredient');
  useEffect(()=>{onPendingChange(pending);},[pending,onPendingChange]);
  useEffect(()=>{
    if (!createdFood) return;
    setSelected(createdFood);setUnit('g');setAmount('');setLastAdded('');
    window.requestAnimationFrame(()=>amountInput.current?.focus());
  },[createdFood]);
  const quantity=parseWeight(amount),grams=selected ? toGrams(selected,quantity,unit) : NaN;
  const valid=Boolean(selected && isPositive(quantity) && isPositive(grams));
  function clear(){setSelected(undefined);setAmount('');setUnit('g');}
  function add(){
    if(disabled)return;
    if(!selected || !valid){notify('Bitte eine Zutat und eine gültige positive Menge wählen.','error');amountInput.current?.focus();return;}
    onChange([...ingredients,makeIngredient(selected,quantity,unit)]);setLastAdded(`${selected.name} hinzugefügt.`);clear();
    window.requestAnimationFrame(()=>{const trigger=composer.current?.querySelector<HTMLButtonElement>('.food-picker__trigger');trigger?.focus();});
  }
  return <section className="recipe-ingredients" aria-labelledby="recipe-ingredients-title"><h3 id="recipe-ingredients-title">Zutaten <span className="recipe-ingredients__count">{ingredients.length}</span></h3>
    <div ref={composer} className="recipe-add" data-recipe-composer onKeyDown={event=>{if(event.key==='Enter' && !event.defaultPrevented && event.target===amountInput.current){event.preventDefault();add();}}}>
      <FoodPicker foods={foods} selected={selected} disabled={disabled} onCreate={onCreateFood} onChange={food=>{if(disabled)return;setSelected(food);setUnit('g');setAmount('');setLastAdded('');window.requestAnimationFrame(()=>amountInput.current?.focus());}}/>
      {selected && <><div className="quantity-fields"><label>Menge<input ref={amountInput} type="text" inputMode="decimal" autoComplete="off" aria-label="Menge der neuen Zutat" value={amount} placeholder="z. B. 150" disabled={disabled} onChange={event=>setAmount(event.target.value)}/></label>
        <label>Einheit<select value={unit} aria-label="Einheit der neuen Zutat" disabled={disabled} onChange={event=>{
          const next=event.target.value as Unit,factor=gramsPerUnit(selected,next);if(isPositive(grams) && isPositive(factor))setAmount(String(Number((grams/factor).toPrecision(12))).replace('.',','));setUnit(next);
        }}>{units.map(value=><option key={value} value={value} disabled={!isPositive(gramsPerUnit(selected,value))}>{value==='portion' ? portionNameLabel(selected.portionName) : unitLabels[value]}</option>)}</select></label></div>
        {unit==='portion' && <PortionPicker food={selected} onChange={setSelected} disabled={disabled}/>}
        {valid && <p className="hint">{entryQuantity({foodSnapshot:selected,amount:quantity,unit,grams})} · {fmt(selected.kcal*grams/100)} kcal</p>}
        {amount && !valid && <p className="recipe-field-error">Bitte eine gültige Menge größer als 0 eingeben.</p>}
        <div className="recipe-add__actions"><button type="button" className="primary" disabled={disabled || !valid} onClick={add}><Plus size={17}/>Zutat hinzufügen</button><button type="button" className="secondary" disabled={disabled} onClick={()=>{clear();window.requestAnimationFrame(()=>composer.current?.querySelector<HTMLButtonElement>('.food-picker__trigger')?.focus());}}><X size={16}/>Verwerfen</button></div>
      </>}
      {error && <p className="recipe-field-error" role="alert">{error}</p>}
      <p className="recipe-add__status" role="status">{lastAdded || (!ingredients.length && !selected ? 'Wähle dein erstes Lebensmittel aus.' : '')}</p>
    </div>
    <div className="recipe-ingredient-list">{ingredients.map((ingredient,index)=><RecipeIngredientCard key={ingredient.id} ingredient={ingredient} index={index} disabled={disabled}
      onChange={value=>onChange(ingredients.map(current=>current.id===ingredient.id ? value : current))} onRemove={()=>onChange(ingredients.filter(current=>current.id!==ingredient.id))}/>)}</div>
  </section>;
}
