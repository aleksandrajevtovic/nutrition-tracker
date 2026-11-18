import {useDraftState} from './DraftRecoveryProvider';

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
  const [tab, setTab] = useDraftState<'templates' | 'shopping' | 'week'>('PlanningPage:tab', 'templates');
  const [editor, setEditor] = useDraftState<{date: string; template?: MealTemplate; plan?: MealPlan} | null>('PlanningPage:editor', null);
  const [plannerDate, setPlannerDate] = useDraftState('PlanningPage:plannerDate', date);
  const [rescheduling,setRescheduling]=useDraftState<MealPlan | null>('PlanningPage:rescheduling', null);
  const data = usePlanningData();
  const confirmNavigation = useNavigationGuard();
  const changeTab = (next: typeof tab) => {if (next !== tab && confirmNavigation()) {setRescheduling(null);setEditor(null);setTab(next);}};
  const openEditor=(next: NonNullable<typeof editor>)=>{
    if(!confirmNavigation())return false;
    setRescheduling(null);setEditor(next);return true;
  };
  const changePlannerDate=(next: string)=>{
    if(next!==plannerDate && confirmNavigation(['plan-editor','plan-date'])){setRescheduling(null);setEditor(null);setPlannerDate(next);}
  };
  return <>
    <div className="heading"><div><span className="eyebrow">VORBEREITEN & VEREINFACHEN</span><h1>Planen & Einkaufen</h1></div></div>
    <div className="planning-tabs" role="group" aria-label="Planungsbereich auswählen">
      <button type="button" aria-pressed={tab === 'templates'} onClick={() => changeTab('templates')}>Vorlagen</button>
      <button type="button" aria-pressed={tab === 'shopping'} onClick={() => changeTab('shopping')}>Einkaufsliste</button>
      <button type="button" aria-pressed={tab === 'week'} onClick={() => changeTab('week')}>Wochenplan</button>
    </div>
    {data.loading ? <p className="hint" role="status">Planungsdaten werden geladen…</p> : data.failed ? <section className="panel"><p>Planungsdaten konnten nicht geladen werden.</p><button type="button" className="secondary" onClick={data.reload}>Erneut versuchen</button></section> : <>
      {tab === 'templates' && <TemplateLibrary templates={data.templates} date={date} onOpenDay={onOpenDay} onPlan={template => {if(openEditor({date,template}))setTab('week');}}/>}
      {tab === 'shopping' && <ShoppingListView foods={foods} shopping={data.shopping}/>}
      {tab === 'week' && <MealPlanner plans={data.plans} date={plannerDate} onDateChange={changePlannerDate} shopping={data.shopping} onCreate={date => {openEditor({date});}} onEdit={plan => {openEditor({date:plan.date,plan});}} onShopping={() => changeTab('shopping')} onOpenDay={onOpenDay}
        rescheduling={rescheduling} onReschedule={plan=>{if(confirmNavigation(['plan-editor','plan-date'])){setEditor(null);setRescheduling(plan);}}} onCloseReschedule={()=>setRescheduling(null)} onRescheduled={date=>{setRescheduling(null);setPlannerDate(date);}}/>}
      {editor && <PlanEditor foods={foods} templates={data.templates} date={editor.date} plan={editor.plan} template={editor.template} onClose={() => setEditor(null)} onSaved={date => {setPlannerDate(date); setEditor(null);}}/>}
    </>}
  </>;
}
