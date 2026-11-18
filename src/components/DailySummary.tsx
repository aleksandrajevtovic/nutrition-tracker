import {useDraftState} from './DraftRecoveryProvider';

import {Target} from 'lucide-react';
import {fmt, stats} from '../nutrition';
import {goalFields, goalProgress} from '../goals';
import {useDailyGoals} from '../hooks/useDailyGoals';
import GoalEditor from './GoalEditor';
import {useNavigationGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';
import './DailySummary.css';

export function GoalProgress({current, target, label, unit}: {current: number; target: number; label: string; unit: string}) {
  const progress = goalProgress(current, target);
  const difference = Math.abs(progress.difference);
  const amount = difference > 0 && difference < 0.1 ? '< 0,1' : fmt(difference);
  return <div className="goal-progress">
    <div className="goal-progress__caption"><span>Ziel: {fmt(target)} {unit}</span><span>{progress.percent} %</span></div>
    <div className="goal-progress__track" role="progressbar" aria-label={`${label}: Tagesziel`} aria-valuemin={0} aria-valuemax={target}
      aria-valuenow={Math.max(0, Math.min(current, target))} aria-valuetext={`${fmt(current)} von ${fmt(target)} ${unit}, ${progress.percent} Prozent`}>
      <div className={progress.difference < 0 ? 'goal-progress__fill goal-progress__fill--over' : 'goal-progress__fill'} style={{width: `${progress.barPercent}%`}}/>
    </div>
    <span className="goal-progress__remaining">{progress.difference === 0 ? 'Ziel erreicht' : progress.difference > 0 ? `Noch ${amount} ${unit}` : `${amount} ${unit} über dem Ziel`}</span>
  </div>;
}

export default function DailySummary({totals, fiberIncomplete = false}: {totals: ReturnType<typeof stats>; fiberIncomplete?: boolean}) {
  const data = useDailyGoals();
  const [editing, setEditing] = useDraftState('DailySummary:editing', false);
  const confirmNavigation = useNavigationGuard();
  const editorRef = useScrollReveal<HTMLDivElement>(editing);
  const hasGoals = Object.keys(data.goals).length > 0;
  return <section className="summary daily-summary" aria-label="Tagesbilanz und Tagesziele">
    <div className="daily-summary__heading"><h2>Tagesbilanz</h2>
      <button type="button" className="daily-summary__edit" disabled={data.loading || data.failed} aria-expanded={editing} onClick={() => {if (!editing || confirmNavigation(['goals'])) setEditing(value => !value);}}>
        <Target size={16}/>{hasGoals ? 'Ziele bearbeiten' : 'Ziele festlegen'}
      </button>
    </div>
    <div className="daily-summary__values"><div className="daily-summary__calories"><span>Kalorien</span><strong>{Math.round(totals.kcal)} <small>kcal</small></strong>
      {data.goals.kcal !== undefined && <GoalProgress current={totals.kcal} target={data.goals.kcal} label="Kalorien" unit="kcal"/>}
    </div><div className="macros">{goalFields.filter(field => field.key !== 'kcal').map(({key, label, unit}) => <div key={key}>
      <span>{label}</span><b>{key === 'fiber' && fiberIncomplete ? 'Unvollständig' : `${fmt(totals[key])} g`}</b>
      {data.goals[key] !== undefined && !(key === 'fiber' && fiberIncomplete) && <GoalProgress current={totals[key]} target={data.goals[key]!} label={label} unit={unit}/>}
    </div>)}</div></div>
    {fiberIncomplete && <p className="daily-summary__notice">Ballaststoffe sind nicht für alle Lebensmittel angegeben. Tageswert und Zielvergleich sind deshalb unvollständig.</p>}
    {data.loading && <p className="daily-summary__notice" role="status">Tagesziele werden geladen…</p>}
    {data.failed && <p className="daily-summary__notice">Tagesziele konnten nicht geladen werden. <button type="button" onClick={data.reload}>Erneut versuchen</button></p>}
    {editing && <div ref={editorRef}><GoalEditor goals={data.goals} onSave={data.save} onClose={() => setEditing(false)}/></div>}
  </section>;
}
