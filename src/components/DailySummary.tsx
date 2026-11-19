import {useDraftState} from './DraftRecoveryProvider';

import {Info, Target} from 'lucide-react';
import type {Entry} from '../db';
import {fmt, stats} from '../nutrition';
import {nutrientCoverage, nutrientMissing} from '../nutrientCoverage';
import {entryQuantity} from '../quantityLabels';
import {goalFields, goalProgress} from '../goals';
import {useDailyGoals} from '../hooks/useDailyGoals';
import GoalEditor from './GoalEditor';
import {useNavigationGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';
import './DailySummary.css';

export function GoalProgress({current, target, label, unit, incomplete = false}: {current: number; target: number; label: string; unit: string; incomplete?: boolean}) {
  const progress = goalProgress(current, target);
  const difference = Math.abs(progress.difference);
  const amount = difference > 0 && difference < 0.1 ? '< 0,1' : fmt(difference);
  return <div className="goal-progress">
    <div className="goal-progress__caption"><span>Ziel: {fmt(target)} {unit}</span><span>{incomplete ? '≥ ' : ''}{progress.percent} %</span></div>
    <div className="goal-progress__track" role="progressbar" aria-label={`${label}: Tagesziel`} aria-valuemin={0} aria-valuemax={target}
      aria-valuenow={Math.max(0, Math.min(current, target))} aria-valuetext={`${incomplete ? 'Mindestens ' : ''}${fmt(current)} von ${fmt(target)} ${unit}, ${progress.percent} Prozent${incomplete ? '. Weitere Angaben fehlen.' : ''}`}>
      <div className={progress.difference < 0 ? 'goal-progress__fill goal-progress__fill--over' : 'goal-progress__fill'} style={{width: `${progress.barPercent}%`}}/>
    </div>
    <span className="goal-progress__remaining">{incomplete ? progress.difference < 0 ? `Mindestens ${amount} ${unit} über dem Ziel` : progress.difference === 0 ? 'Ziel mindestens erreicht' : `Mindestens ${fmt(current)} ${unit} erfasst` : progress.difference === 0 ? 'Ziel erreicht' : progress.difference > 0 ? `Noch ${amount} ${unit}` : `${amount} ${unit} über dem Ziel`}</span>
  </div>;
}

export default function DailySummary({totals, entries, onCompleteEntry}: {totals: ReturnType<typeof stats>; entries: Entry[]; onCompleteEntry: (entry: Entry) => void}) {
  const data = useDailyGoals();
  const [editing, setEditing] = useDraftState('DailySummary:editing', false);
  const confirmNavigation = useNavigationGuard();
  const editorRef = useScrollReveal<HTMLDivElement>(editing);
  const hasGoals = Object.keys(data.goals).length > 0;
  const missingFoods = entries.map(entry => {
    const food = entry.foodSnapshot;
    const labels = [...goalFields, {key:'sugar' as const, label:'Zucker', unit:'g'}].filter(({key}) => nutrientMissing(food, key)).map(({label}) => label);
    return {entry, labels};
  }).filter(food => food.labels.length);
  return <section className="summary daily-summary" aria-label="Tagesbilanz und Tagesziele">
    <div className="daily-summary__heading"><h2>Tagesbilanz</h2>
      <button type="button" className="daily-summary__edit" disabled={data.loading || data.failed} aria-expanded={editing} onClick={() => {if (!editing || confirmNavigation(['goals'])) setEditing(value => !value);}}>
        <Target size={16}/>{hasGoals ? 'Ziele bearbeiten' : 'Ziele festlegen'}
      </button>
    </div>
    <div className="daily-summary__values"><div className="daily-summary__calories"><span>Kalorien</span><strong>{Math.round(totals.kcal)} <small>kcal</small></strong>
      {data.goals.kcal !== undefined && <GoalProgress current={totals.kcal} target={data.goals.kcal} label="Kalorien" unit="kcal"/>}
    </div><div className="macros">{goalFields.filter(field => field.key !== 'kcal').map(({key, label, unit}) => {
      const coverage = nutrientCoverage(entries, key);
      return <div key={key}><span>{label}</span><b>{coverage.missing && !coverage.hasKnown ? '—' : `${coverage.missing ? '≥ ' : ''}${fmt(totals[key])} g`}</b>
        {data.goals[key] !== undefined && (!coverage.missing || coverage.hasKnown) && <GoalProgress current={totals[key]} target={data.goals[key]!} label={label} unit={unit} incomplete={coverage.missing}/>}</div>;
    })}</div></div>
    {missingFoods.length > 0 && <details className="daily-summary__missing"><summary><span>Einige Nährwerte fehlen</span><Info size={14} aria-hidden="true"/></summary>
      <p>Angezeigt werden die bekannten Werte. „≥“ bedeutet mindestens; „—“ bedeutet, dass noch keine Angabe vorliegt.</p>
      <ul>{missingFoods.map(({entry, labels}, index) => <li key={entry.id}>
        <div><p>Bei {entry.foodSnapshot.name} fehlen: {labels.join(', ')}.</p><span>{entry.meal} · {entryQuantity(entry)}</span></div>
        <button type="button" aria-label={`Angaben ergänzen für ${entry.foodSnapshot.name}, ${entry.meal}, Eintrag ${index + 1}`} onClick={() => onCompleteEntry(entry)}>Angaben ergänzen</button>
      </li>)}</ul>
    </details>}
    {data.loading && <p className="daily-summary__notice" role="status">Tagesziele werden geladen…</p>}
    {data.failed && <p className="daily-summary__notice">Tagesziele konnten nicht geladen werden. <button type="button" onClick={data.reload}>Erneut versuchen</button></p>}
    {editing && <div ref={editorRef}><GoalEditor goals={data.goals} onSave={data.save} onClose={() => setEditing(false)}/></div>}
  </section>;
}
