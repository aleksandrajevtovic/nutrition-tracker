import {useEffect, useId, useRef, useState} from 'react';
import {ChevronDown, Plus, Trash2} from 'lucide-react';
import type {Food} from '../db';
import {fmt, isPositive} from '../nutrition';
import type {FoodFieldErrors} from '../foodEditorValidation';
import FoodFieldError, {foodFieldProps} from './FoodFieldError';

export function PortionNameSuggestions({value,onSelect,disabled}: {value: string;onSelect: (value: string) => void;disabled: boolean}) {
  return <div className="portion-suggestions" role="group" aria-label="Vorschläge für Portionsnamen">{['Stück','Scheibe','Becher','Esslöffel','Klein','Mittel','Groß'].map(name =>
    <button key={name} type="button" disabled={disabled} aria-pressed={value === name} onClick={() => onSelect(name)}>{name}</button>)}</div>;
}

export default function FoodPortions({portions,onChange,disabled,errors = {},prefix: providedPrefix}: {
  portions: NonNullable<Food['portions']>;onChange: (portions: NonNullable<Food['portions']>) => void;disabled: boolean;
  errors?: FoodFieldErrors;prefix?: string;
}) {
  const fallbackPrefix = useId();const prefix = providedPrefix ?? fallbackPrefix;
  const [ids,setIds] = useState(() => portions.map(() => crypto.randomUUID()));
  const [expanded,setExpanded] = useState<Set<string>>(() => new Set());
  const root = useRef<HTMLDivElement>(null);
  const nextFocus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!nextFocus.current) return;
    const input = root.current?.querySelector<HTMLInputElement>(`[data-portion-id="${nextFocus.current}"] input`);
    if (input) {input.focus({preventScroll:true});input.scrollIntoView({block:'nearest',behavior:'instant'});nextFocus.current=undefined;}
  }, [ids]);
  return <div className="food-portions" ref={root}>
    <h4>Weitere Portionsgrößen{portions.length > 0 && <span className="food-portions__count">{portions.length}</span>}</h4>
    <p className="hint">Eigene Größen mit demselben Nährwertprofil. Vorschläge füllen nur den Namen aus.</p>
    {portions.map((portion,index) => <div className="food-portions__card" key={ids[index]} data-portion-id={ids[index]}>
      <details open={expanded.has(ids[index])} onToggle={event => {const open=event.currentTarget.open;setExpanded(previous => {if(previous.has(ids[index])===open)return previous;const next=new Set(previous);if(open)next.add(ids[index]);else next.delete(ids[index]);return next;});}}>
        <summary><span><strong>{portion.name.trim() || 'Neue Portion'}</strong><small>{isPositive(portion.grams) ? `${fmt(portion.grams,3)} g` : 'Gewicht ergänzen'}</small></span><ChevronDown size={17} aria-hidden="true"/></summary>
        <div className="food-portions__content"><div className="food-portions__fields">
          <label>Portionsname<input {...foodFieldProps(`portions.${index}.name`,errors,prefix)} aria-label={`Name der Portionsgröße ${index+1}`} required placeholder="z. B. Klein" value={portion.name} disabled={disabled} onChange={event => onChange(portions.map((value,i) => i===index ? {...value,name:event.target.value} : value))}/><FoodFieldError field={`portions.${index}.name`} errors={errors} prefix={prefix}/></label>
          <label>Gewicht <span className="food-editor__unit">g</span><input {...foodFieldProps(`portions.${index}.grams`,errors,prefix)} aria-label={`Gramm der Portionsgröße ${index+1}`} type="number" min="0" step="any" required placeholder="z. B. 80" value={Number.isFinite(portion.grams) ? portion.grams : ''} disabled={disabled} onChange={event => onChange(portions.map((value,i) => i===index ? {...value,grams:event.target.value === '' ? NaN : Number(event.target.value)} : value))}/><FoodFieldError field={`portions.${index}.grams`} errors={errors} prefix={prefix}/></label>
        </div><PortionNameSuggestions value={portion.name} disabled={disabled} onSelect={name => onChange(portions.map((value,i) => i===index ? {...value,name} : value))}/></div>
      </details>
      <button className="iconbtn food-portions__remove" type="button" disabled={disabled} aria-label={`Portionsgröße ${index+1} entfernen`} onClick={() => {onChange(portions.filter((_,i) => i!==index));setIds(ids.filter((_,i) => i!==index));setExpanded(previous => {const next=new Set(previous);next.delete(ids[index]);return next;});}}><Trash2 size={17}/></button>
    </div>)}
    <button className="secondary food-portions__add" type="button" disabled={disabled} onClick={() => {const id=crypto.randomUUID();nextFocus.current=id;setIds([...ids,id]);setExpanded(previous => new Set([...previous,id]));onChange([...portions,{name:'',grams:NaN}]);}}><Plus size={17}/>Weitere Portion</button>
  </div>;
}
