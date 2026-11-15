import {useId, useState} from 'react';
import {goalFields, type DailyGoals, type GoalKey} from '../goals';
import {fmt} from '../nutrition';
import {weekDay, type WeekSummary} from '../week';
import {weightDate} from '../weight';

const compact = (value: number) => value.toLocaleString('de-DE', {notation: 'compact', maximumFractionDigits: 1});

export default function WeeklyNutritionChart({week, goals, onOpenDay}: {week: WeekSummary; goals: DailyGoals; onOpenDay: (date: string) => void}) {
  const id = useId();
  const [metric, setMetric] = useState<GoalKey>('kcal');
  const field = goalFields.find(field => field.key === metric)!;
  const maximum = Math.max(1, goals[metric] ?? 0, ...week.days.map(day => day.totals[metric]));
  const target = goals[metric];

  return <section className="panel weekly-chart" aria-labelledby={`${id}-title`}>
    <div className="weekly-chart__heading"><h2 id={`${id}-title`}>Tagesvergleich</h2>
      <label htmlFor={`${id}-metric`}>Nährwert<select id={`${id}-metric`} aria-label="Nährwert" value={metric} onChange={event => setMetric(event.target.value as GoalKey)}>
        {goalFields.map(field => <option key={field.key} value={field.key}>{field.label} ({field.unit})</option>)}
      </select></label></div>
    <p className="hint">{target !== undefined ? `Gestrichelte Linie: Tagesziel ${fmt(target)} ${field.unit}. ` : ''}Wähle einen Balken, um den Tag zu öffnen.</p>
    <div className="weekly-bars">
      {target !== undefined && <div className="weekly-bars__target" aria-hidden="true" style={{top: `${24 + (1 - target / maximum) * 160}px`}}/>}
      {week.days.map(day => <button key={day.date} type="button" className="weekly-bar" onClick={() => onOpenDay(day.date)}
        aria-label={`${weekDay(day.date, true)}, ${weightDate(day.date)}: ${day.count ? `${fmt(day.totals[metric])} ${field.unit}` : 'Keine Einträge'}. Im Tagebuch öffnen`}>
        <span className="weekly-bar__value">{day.count ? compact(day.totals[metric]) : '—'}</span>
        <span className={`weekly-bar__track${day.count ? '' : ' weekly-bar__track--empty'}`}>
          {day.count > 0 && <span className="weekly-bar__fill" style={{height: `${day.totals[metric] / maximum * 100}%`}}/>}
        </span>
        <span className="weekly-bar__day">{weekDay(day.date).replace('.', '')}</span><span className="weekly-bar__date">{day.date.slice(8)}.</span>
      </button>)}
    </div>
    <p className="hint">Werte in {field.unit}. „—“ bedeutet: keine Einträge. Erfasste Werte von 0 bleiben als 0 sichtbar.</p>
  </section>;
}
