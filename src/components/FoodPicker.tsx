import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {Check, ChevronDown, Plus, Search, Star} from 'lucide-react';
import type {Food} from '../db';
import {filterFoods} from '../foods';
import './FoodPicker.css';

type Props = {foods: Food[]; selected?: Food; onChange: (food: Food) => void; disabled?: boolean; onCreate?: (name: string) => void};
const foodLabel = (food: Food) => food.brand ? `${food.brand} · ${food.name}` : food.name;

export default function FoodPicker({foods, selected, onChange, disabled = false, onCreate}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const activeOption = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const filtered = filterFoods(foods, query);
  const favoriteCount = filtered.filter(food => food.favorite).length;
  const groups = [
    {label: 'Favoriten', options: filtered.slice(0, favoriteCount), offset: 0},
    {label: favoriteCount ? 'Weitere Lebensmittel' : 'Alle Lebensmittel', options: filtered.slice(favoriteCount), offset: favoriteCount},
  ].filter(group => group.options.length);
  const activeIndex = Math.min(active, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (open) activeOption.current?.scrollIntoView({block: 'nearest'});
  }, [open, activeIndex, query]);

  function showOptions() {
    setQuery('');
    setActive(Math.max(0, filterFoods(foods, '').findIndex(food => food.id === selected?.id)));
    setOpen(true);
  }

  function choose(food: Food) {
    if (disabled) return;
    onChange(food);
    setOpen(false);
    trigger.current?.focus();
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      setOpen(false); trigger.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActive(Math.max(0, Math.min(filtered.length - 1, activeIndex + direction)));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[activeIndex]) choose(filtered[activeIndex]);
    }
  }

  return <div className="food-picker" ref={root} onKeyDown={event => {
    if (open && event.key === 'Escape') {event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}
  }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label htmlFor={`${id}-trigger`}>Lebensmittel</label>
    <button ref={trigger} id={`${id}-trigger`} type="button" className="food-picker__trigger" disabled={disabled}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
      onClick={() => open ? setOpen(false) : showOptions()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault(); showOptions();}
      }}>
      <span>{selected ? foodLabel(selected) : 'Bitte wählen'}</span><ChevronDown size={17} aria-hidden="true"/>
    </button>
    {open && <div className="food-picker__dropdown">
      <div className="food-picker__search"><Search size={17} aria-hidden="true"/>
        <input ref={search} type="text" role="combobox" aria-label="Lebensmittel suchen" disabled={disabled}
          aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          placeholder="Nach Name oder Marke suchen…" autoComplete="off" value={query}
          onChange={event => {setQuery(event.target.value); setActive(0);}} onKeyDown={handleKeys}/>
      </div>
      <div id={`${id}-list`} role="listbox" aria-label="Lebensmittel" className="food-picker__options">
        {groups.map(group => <div key={group.label} role="group" aria-label={group.label}>
          <div className="food-picker__group-title" aria-hidden="true">{group.label}</div>
          {group.options.map((food, position) => {
            const index = group.offset + position;
            return <div key={food.id} id={`${id}-option-${index}`}
          role="option" aria-selected={food.id === selected?.id}
          ref={index === activeIndex ? activeOption : undefined}
          className={`food-picker__option${index === activeIndex ? ' food-picker__option--active' : ''}`}
          onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(food)}>
          <span className="food-picker__name">{food.favorite && <Star size={14} fill="currentColor" aria-hidden="true"/>}{foodLabel(food)}</span>{food.id === selected?.id && <Check size={17} aria-hidden="true"/>}
        </div>;
          })}
        </div>)}
      </div>
      {filtered.length === 0 && <p className="food-picker__empty" role="status">Keine Lebensmittel gefunden.</p>}
      {onCreate && <div className="food-picker__create"><button type="button" disabled={disabled} onClick={() => {
        if (disabled) return;
        setOpen(false);onCreate(query.trim());
      }}><Plus size={17} aria-hidden="true"/>Lebensmittel anlegen</button></div>}
    </div>}
  </div>;
}
