import {useState} from 'react';
import type {Food} from '../db';
import type {MealPlan, MealTemplate} from '../planning';
import {usePlanningData} from '../hooks/usePlanningData';
import TemplateLibrary from './TemplateLibrary';
import ShoppingListView from './ShoppingListView';
import MealPlanner from './MealPlanner';
import PlanEditor from './PlanEditor';
import {useNavigationGuard} from './UnsavedChangesProvider';
import './WeeklyPage.css';
import './PlanningPage.css';

export default function PlanningPage({foods, date, onOpenDay}: {foods: Food[]; date: string; onOpenDay: (date: string) => void}) {
  const [tab, setTab] = useState<'templates' | 'shopping' | 'week'>('templates');
  const [editor, setEditor] = useState<{date: string; template?: MealTemplate; plan?: MealPlan} | null>(null);
  const [plannerDate, setPlannerDate] = useState(date);
  const data = usePlanningData();
  const confirmNavigation = useNavigationGuard();
  const changeTab = (next: typeof tab) => {if (next !== tab && confirmNavigation()) setTab(next);};
  return <>
    <div className="heading"><div><span className="eyebrow">VORBEREITEN & VEREINFACHEN</span><h1>Planen & Einkaufen</h1></div></div>
    <div className="planning-tabs" role="group" aria-label="Planungsbereich auswählen">
      <button type="button" aria-pressed={tab === 'templates'} onClick={() => changeTab('templates')}>Vorlagen</button>
      <button type="button" aria-pressed={tab === 'shopping'} onClick={() => changeTab('shopping')}>Einkaufsliste</button>
      <button type="button" aria-pressed={tab === 'week'} onClick={() => changeTab('week')}>Wochenplan</button>
    </div>
    {data.loading ? <p className="hint" role="status">Planungsdaten werden geladen…</p> : data.failed ? <section className="panel"><p>Planungsdaten konnten nicht geladen werden.</p><button type="button" className="secondary" onClick={data.reload}>Erneut versuchen</button></section> : <>
      {tab === 'templates' && <TemplateLibrary templates={data.templates} date={date} onOpenDay={onOpenDay} onPlan={template => {setTab('week'); setEditor({date, template});}}/>}
      {tab === 'shopping' && <ShoppingListView foods={foods} shopping={data.shopping}/>}
      {tab === 'week' && <MealPlanner plans={data.plans} date={plannerDate} onDateChange={setPlannerDate} shopping={data.shopping} onCreate={date => setEditor({date})} onEdit={plan => setEditor({date: plan.date, plan})} onShopping={() => setTab('shopping')} onOpenDay={onOpenDay}/>}
      {editor && <PlanEditor foods={foods} templates={data.templates} date={editor.date} plan={editor.plan} template={editor.template} onClose={() => setEditor(null)} onSaved={date => {setPlannerDate(date); setEditor(null);}}/>}
    </>}
  </>;
}
