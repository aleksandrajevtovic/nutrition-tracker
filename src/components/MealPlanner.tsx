import {useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Pencil, Plus, Trash2} from 'lucide-react';
import {getDataRevision} from '../db';
import {logPlan, removePlanningRecord, restorePlanningRecord, shoppingFromPlanWeek} from '../planningDb';
import {mealTotals, type MealPlan, type ShoppingList} from '../planning';
import {calendarWeek, shiftDate, weekDay} from '../week';
import {fmt, today} from '../nutrition';
import {portionQuantity} from '../quantityLabels';
import {validDate, weightDate} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';

export default function MealPlanner({plans, date, shopping, onCreate, onEdit, onShopping, onOpenDay, onDateChange}: {
  plans: MealPlan[]; date: string; shopping: ShoppingList; onCreate: (date: string) => void; onEdit: (plan: MealPlan) => void;
  onShopping: () => void; onOpenDay: (date: string) => void; onDateChange: (date: string) => void;
}) {
  const anchor = date;
  const setAnchor = onDateChange;
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const range = calendarWeek(anchor);
  const notify = useToast();
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true);
    try {await action();} catch (error) {notify(germanError(error), 'error');}
    finally {running.current = false; setBusy(false);}
  }
  function generateShopping(append: boolean) {
    if (!append && shopping.items.length && !confirm('Vorhandene Einkaufsliste durch die Zutaten der noch offenen Wochenplanung ersetzen?')) return;
    void run(async () => {await shoppingFromPlanWeek(range.start, range.end, append); notify('Einkaufsliste aus dem Wochenplan erstellt.', 'success'); onShopping();});
  }
  return <>
    <section className="panel week-picker" aria-label="Planungswoche auswählen"><div className="week-picker__navigation">
      <button type="button" className="iconbtn" aria-label="Vorherige Planungswoche" onClick={() => setAnchor(shiftDate(range.start, -7))}><ChevronLeft size={20}/></button>
      <div aria-live="polite"><strong>KW {range.number} · {range.year}</strong><span>{weightDate(range.start)} – {weightDate(range.end)}</span></div>
      <button type="button" className="iconbtn" aria-label="Nächste Planungswoche" onClick={() => setAnchor(shiftDate(range.start, 7))}><ChevronRight size={20}/></button></div>
      <label className="week-picker__date">Datum im Wochenplan<input type="date" value={anchor} onChange={event => {if (validDate(event.target.value)) setAnchor(event.target.value);}}/></label>
    </section>
    <div className="planning-actions"><button type="button" className="secondary" onClick={() => setAnchor(today())}>Diese Woche</button>
      <button type="button" className="primary" onClick={() => onCreate(anchor)}><Plus size={17}/>Mahlzeit planen</button></div>
    <section className="panel"><h2>Einkauf für diese Woche</h2><p className="hint">Nur noch nicht übernommene Planungen dieser Woche werden berücksichtigt. Rezepte werden auf Zutaten heruntergerechnet.</p>
      <div className="planning-actions"><button type="button" className="secondary" disabled={busy} onClick={() => generateShopping(false)}>Einkaufsliste aus Wochenplan</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => generateShopping(true)}>Wochenplan zur Liste hinzufügen</button></div></section>
    <div className="planner-days">{range.dates.map(day => <section className="panel planner-day" key={day}>
      <div className="planning-card-heading"><div><h2>{weekDay(day, true)}</h2><p className="hint">{weightDate(day)}{day === today() ? ' · Heute' : ''}</p></div>
        <button type="button" className="iconbtn" aria-label={`Mahlzeit am ${weightDate(day)} planen`} onClick={() => onCreate(day)}><Plus size={18}/></button></div>
      {!plans.some(plan => plan.date === day) && <p className="hint">Noch nichts geplant.</p>}
      {plans.filter(plan => plan.date === day).map(plan => <article className="planner-meal" key={plan.id}>
        <div className="planning-card-heading"><div><strong>{plan.name}</strong><small>{plan.meal} · {Math.round(mealTotals(plan.items).kcal)} kcal · {plan.status === 'logged' ? 'Übernommen' : 'Geplant'}</small></div>
          <div className="actions"><button type="button" disabled={busy || plan.status === 'logged'} aria-label={`${plan.name} als Planung bearbeiten`} title="Planung bearbeiten" onClick={() => onEdit(plan)}><Pencil size={16}/></button>
            <button type="button" disabled={busy} aria-label={`${plan.name} als Planung löschen`} title="Planung löschen" onClick={() => void run(async () => {
              const revision = getDataRevision(); const removed = await removePlanningRecord('plans', plan.id);
              if (removed) notify('Planung gelöscht. Tagebucheinträge bleiben erhalten.', 'success', {label: 'Rückgängig', onClick: async () => {await restorePlanningRecord('plans', removed, revision); notify('Planung wiederhergestellt.', 'success');}});
            })}><Trash2 size={16}/></button></div></div>
        <ul className="planning-items">{plan.items.map((item, index) => <li key={index}><span>{item.foodSnapshot.name}</span><small>{item.unit === 'portion' && item.amount !== undefined ? portionQuantity(item.amount,item.foodSnapshot.portionName,item.grams,2) : `${fmt(item.grams,2)} g`}</small></li>)}</ul>
        {plan.status === 'planned' ? <button type="button" className="secondary wide" disabled={busy} onClick={() => void run(async () => {
          await logPlan(plan.id); notify('Geplante Mahlzeit ins Tagebuch übernommen.', 'success', {label: 'Tag öffnen', onClick: () => onOpenDay(plan.date)});
        })}>Ins Tagebuch übernehmen</button> : <button type="button" className="secondary wide" onClick={() => onOpenDay(plan.date)}>Tag im Tagebuch öffnen</button>}
      </article>)}
    </section>)}</div>
  </>;
}
