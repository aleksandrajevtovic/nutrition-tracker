import {useRef, useState} from 'react';
import {Check, X} from 'lucide-react';
import type {Food} from '../db';
import {itemFromFood, mealTotals, scaleItems, type MealPlan, type MealTemplate} from '../planning';
import {savePlan} from '../planningDb';
import {fmt, gramsPerUnit, isPositive, meals, unitLabels, units, type Unit} from '../nutrition';
import {parseWeight} from '../weight';
import {germanError} from '../german';
import FoodPicker from './FoodPicker';
import PortionPicker from './PortionPicker';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';

export default function PlanEditor({foods, templates, date, plan, template, onClose, onSaved}: {
  foods: Food[]; templates: MealTemplate[]; date: string; plan?: MealPlan; template?: MealTemplate; onClose: () => void; onSaved: (date: string) => void;
}) {
  const [source, setSource] = useState<'food' | 'template'>(template ? 'template' : 'food');
  const [chosenTemplate, setChosenTemplate] = useState(template?.id ?? templates[0]?.id ?? '');
  const [food, setFood] = useState<Food>();
  const [target, setTarget] = useState(plan?.date ?? date);
  const [meal, setMeal] = useState(plan?.meal ?? template?.meal ?? 'Mittagessen');
  const [name, setName] = useState(plan?.name ?? '');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<Unit>('portion');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const notify = useToast();
  const guard = useDraftGuard('Wochenplanung', {source, chosenTemplate, food, target, meal, name, amount, unit}, busy, 'plan-editor');
  const selectedTemplate = templates.find(current => current.id === chosenTemplate);
  const factor = parseWeight(amount);
  let items = plan?.items ?? (source === 'template' ? selectedTemplate?.items : food ? [itemFromFood(food, 1, unit)] : undefined);
  try {if (items) items = scaleItems(items, factor);} catch {items = undefined;}
  const totals = items ? mealTotals(items) : undefined;

  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="plan-editor-title"><form className="modal editor" onSubmit={async event => {
    event.preventDefault(); if (saving.current) return;
    if (!items) {notify('Bitte eine gültige Vorlage oder ein Lebensmittel und eine positive Menge wählen.', 'error'); return;}
    saving.current = true; setBusy(true);
    try {
      await savePlan({id: plan?.id ?? crypto.randomUUID(), name: name.trim() || (plan?.name ?? (source === 'template' ? selectedTemplate!.name : food!.name)),
        date: target, meal, items, status: 'planned', entryIds: [], createdAt: plan?.createdAt ?? new Date().toISOString()});
      guard.markSaved(); notify(plan ? 'Planung aktualisiert.' : 'Mahlzeit geplant.', 'success'); onSaved(target);
    } catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }}>
    <div className="section-head"><h2 id="plan-editor-title">{plan ? 'Planung bearbeiten' : 'Mahlzeit planen'}</h2><button type="button" className="iconbtn" disabled={busy} aria-label="Planung schließen" onClick={() => {if (guard.confirmLeave()) onClose();}}><X size={18}/></button></div>
    <div className="quantity-fields"><label>Geplantes Datum<input type="date" required value={target} disabled={busy} onChange={event => setTarget(event.target.value)}/></label>
      <label>Mahlzeit<select aria-label="Geplante Mahlzeit" value={meal} disabled={busy} onChange={event => setMeal(event.target.value)}>{Array.from(new Set([...meals, meal])).map(value => <option key={value}>{value}</option>)}</select></label></div>
    {!plan && <><label>Quelle<select aria-label="Quelle der Planung" value={source} disabled={busy} onChange={event => setSource(event.target.value as 'food' | 'template')}>
      <option value="food">Lebensmittel / Rezept</option><option value="template" disabled={!templates.length}>Mahlzeiten-Vorlage</option></select></label>
      {source === 'template' ? <label>Vorlage<select aria-label="Geplante Vorlage" value={chosenTemplate} disabled={busy} onChange={event => setChosenTemplate(event.target.value)}>{templates.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        : <FoodPicker foods={foods} selected={food} disabled={busy} onChange={value => {setFood(value); setUnit('portion');}}/>}</>}
    <label>Name (optional)<input value={name} disabled={busy} placeholder={plan?.name ?? (source === 'template' ? selectedTemplate?.name : food?.name)} onChange={event => setName(event.target.value)}/></label>
    <div className="quantity-fields"><label>{plan || source === 'template' ? 'Mengenfaktor' : 'Menge'}<input type="text" inputMode="decimal" required value={amount} disabled={busy} onChange={event => setAmount(event.target.value)}/></label>
      {!plan && source === 'food' && <label>Einheit<select aria-label="Einheit der Planung" value={unit} disabled={busy || !food} onChange={event => setUnit(event.target.value as Unit)}>
        {units.map(value => <option key={value} value={value} disabled={food ? !isPositive(gramsPerUnit(food, value)) : value !== 'portion'}>{value === 'portion' && food ? food.portionName : unitLabels[value]}</option>)}
      </select></label>}</div>
    {!plan && source === 'food' && food && unit === 'portion' && <PortionPicker food={food} onChange={setFood} disabled={busy}/>}
    {totals && <div className="preview"><b>{Math.round(totals.kcal)} kcal geplant</b><span>P {fmt(totals.protein)} g · KH {fmt(totals.carbs)} g · F {fmt(totals.fat)} g</span></div>}
    <p className="hint">Geplante Mahlzeiten zählen erst nach „Ins Tagebuch übernehmen“ zu deinen erfassten Tages- und Wochenwerten. Beim Bearbeiten skaliert der Faktor die bisher geplanten Mengen.</p>
    <button className="primary wide" disabled={busy || !items}><Check size={17}/>{busy ? 'Wird gespeichert…' : 'Planung speichern'}</button>
  </form></div>;
}
