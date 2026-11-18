import {useDraftState} from './DraftRecoveryProvider';
import {useRef, useState} from 'react';
import {Bookmark, CalendarPlus, Trash2, X} from 'lucide-react';
import {applyTemplate, removePlanningRecord, restorePlanningRecord} from '../planningDb';
import {getDataRevision} from '../db';
import {mealTotals, type MealTemplate} from '../planning';
import {fmt, meals} from '../nutrition';
import {parseWeight} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard, useNavigationGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';

function TemplateApply({template, date, onClose, onOpenDay}: {template: MealTemplate; date: string; onClose: () => void; onOpenDay: (date: string) => void}) {
  const [target, setTarget] = useDraftState(`TemplateLibrary:${template.id}:target`, date);
  const [meal, setMeal] = useDraftState(`TemplateLibrary:${template.id}:meal`, template.meal);
  const [factor, setFactor] = useDraftState(`TemplateLibrary:${template.id}:factor`, '1');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const notify = useToast();
  const guard = useDraftGuard('Vorlage eintragen', {target, meal, factor}, busy, 'template-apply');
  const formRef = useScrollReveal<HTMLFormElement>(true);
  return <form ref={formRef} className="editor planning-inline-form" onSubmit={async event => {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true);
    try {
      await applyTemplate(template.id, target, meal, parseWeight(factor));
      guard.markSaved();
      notify('Vorlage ins Tagebuch eingetragen.', 'success', {label: 'Tag öffnen', onClick: () => onOpenDay(target)}); onClose();
    } catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }}>
    <div className="section-head"><h3>Vorlage eintragen</h3><button type="button" className="iconbtn" disabled={busy} aria-label="Vorlage eintragen abbrechen" onClick={() => {if (guard.confirmLeave()) onClose();}}><X size={17}/></button></div>
    <div className="quantity-fields"><label>Zieldatum<input type="date" required value={target} disabled={busy} onChange={event => setTarget(event.target.value)}/></label>
      <label>Zielmahlzeit<select aria-label="Zielmahlzeit" value={meal} disabled={busy} onChange={event => setMeal(event.target.value)}>{Array.from(new Set([...meals, template.meal])).map(name => <option key={name}>{name}</option>)}</select></label></div>
    <label>Faktor<input type="text" inputMode="decimal" required value={factor} disabled={busy} onChange={event => setFactor(event.target.value)}/></label>
    <p className="hint">1 übernimmt die gespeicherten Mengen, 0,5 die Hälfte und 2 die doppelte Menge. Vorhandene Einträge bleiben erhalten.</p>
    <button className="primary wide" disabled={busy}>{busy ? 'Wird eingetragen…' : 'Vorlage ins Tagebuch eintragen'}</button>
  </form>;
}

export default function TemplateLibrary({templates, date, onPlan, onOpenDay}: {templates: MealTemplate[]; date: string; onPlan: (template: MealTemplate) => void; onOpenDay: (date: string) => void}) {
  const [applying, setApplying] = useDraftState<string | null>('TemplateLibrary:applying', null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const confirmNavigation = useNavigationGuard();
  const notify = useToast();
  async function remove(template: MealTemplate) {
    if (deleting) return;
    setDeleting(template.id);
    try {
      const revision = getDataRevision();
      const removed = await removePlanningRecord('templates', template.id);
      if (removed) notify('Vorlage gelöscht.', 'success', {label: 'Rückgängig', onClick: async () => {await restorePlanningRecord('templates', removed, revision); notify('Vorlage wiederhergestellt.', 'success');}});
    } catch (error) {notify(germanError(error), 'error');}
    finally {setDeleting(null);}
  }
  return <>
    <p className="hint">Speichere im Tagebuch eine ganze Mahlzeit über „Als Vorlage speichern“. Gespeicherte Vorlagen behalten ihre Mengen und Nährwerte.</p>
    {!templates.length ? <div className="empty"><Bookmark size={28}/><strong>Noch keine Vorlagen</strong><p>Öffne eine Mahlzeit im Tagebuch und speichere deine erste Vorlage.</p></div>
      : <div className="planning-card-grid">{templates.map(template => <article className="panel template-card" key={template.id}>
        <div className="planning-card-heading"><div><h2>{template.name}</h2><p className="hint">{template.meal} · {template.items.length} Einträge · {Math.round(mealTotals(template.items).kcal)} kcal</p></div>
          <button type="button" className="iconbtn" disabled={deleting !== null} aria-label={`${template.name} als Vorlage löschen`} onClick={() => void remove(template)}><Trash2 size={17}/></button></div>
        <ul className="planning-items">{template.items.map((item, index) => <li key={index}><span>{item.foodSnapshot.name}</span><small>{fmt(item.grams, 2)} g</small></li>)}</ul>
        <div className="planning-actions"><button type="button" className="primary" aria-expanded={applying === template.id} onClick={() => {if (confirmNavigation(['template-apply'])) setApplying(applying === template.id ? null : template.id);}}>Eintragen</button>
          <button type="button" className="secondary" onClick={() => {if (confirmNavigation(['template-apply'])) onPlan(template);}}><CalendarPlus size={17}/>Planen</button></div>
        {applying === template.id && <TemplateApply template={template} date={date} onOpenDay={onOpenDay} onClose={() => setApplying(null)}/>}
      </article>)}</div>}
  </>;
}
