import {useDraftState} from './DraftRecoveryProvider';
import {useEffect, useId, useRef, useState} from 'react';
import {CalendarDays, X} from 'lucide-react';
import type {MealPlan} from '../planning';
import {reschedulePlan} from '../planningDb';
import {validDate, weightDate} from '../weight';
import {germanError} from '../german';
import {useDraftGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';
import {useToast} from './ToastProvider';
import './PlanDateForm.css';

export default function PlanDateForm({plan,onClose,onMoved}: {plan: MealPlan;onClose: () => void;onMoved: (date: string) => void}) {
  const id=useId();const notify=useToast();
  const [date,setDate]=useDraftState('PlanDateForm:date', plan.date),[busy,setBusy]=useState(false);
  const running=useRef(false),input=useRef<HTMLInputElement>(null);
  const form=useScrollReveal<HTMLFormElement>(true);
  const guard=useDraftGuard('Anderer Tag für Planung',date,busy,'plan-date');
  useEffect(()=>{input.current?.focus({preventScroll:true});},[]);
  const valid=validDate(date) && date!==plan.date;
  return <form ref={form} className="plan-date-form editor" aria-labelledby={`${id}-title`} onSubmit={async event=>{
    event.preventDefault();if(running.current || !valid)return;
    running.current=true;setBusy(true);
    try{
      const moved=await reschedulePlan(plan.id,plan.date,date);guard.markSaved();
      notify(`„${moved.name}“ auf ${weightDate(moved.date)} verschoben.`,'success');onMoved(moved.date);
    }catch(error){notify(germanError(error),'error');}
    finally{running.current=false;setBusy(false);}
  }}>
    <div className="plan-date-form__heading"><h3 id={`${id}-title`}>Anderer Tag</h3><button type="button" className="iconbtn" disabled={busy} aria-label="Datumsänderung schließen" onClick={()=>{if(guard.confirmLeave())onClose();}}><X size={17}/></button></div>
    <p className="hint">Bisher: {weightDate(plan.date)} · {plan.meal}</p>
    <label htmlFor={`${id}-date`}>Neues Datum</label><div className="plan-date-form__fields"><input ref={input} id={`${id}-date`} aria-label="Neues Datum für Planung" type="date" required disabled={busy} value={date} onChange={event=>setDate(event.target.value)}/><button className="primary" disabled={busy || !valid}><CalendarDays size={17}/>{busy ? 'Wird verschoben…' : 'Verschieben'}</button></div>
  </form>;
}
