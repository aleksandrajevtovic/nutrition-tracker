import {useId, useState} from 'react';
import {goalFields, type DailyGoals, type GoalKey} from '../goals';
import {fmt} from '../nutrition';
import {weekDay, type WeekSummary} from '../week';
import {weightDate} from '../weight';

const compact = (value: number, digits = 1) => value.toLocaleString('de-DE', {notation: 'compact', maximumFractionDigits: digits});

export default function WeeklyNutritionChart({week, goals, onOpenDay}: {week: WeekSummary; goals: DailyGoals; onOpenDay: (date: string) => void}) {
  const id = useId();
  const [metric, setMetric] = useState<GoalKey | 'drinks'>('kcal');
  const field = metric === 'drinks' ? {label: 'Trinkmenge', unit: 'l'} : goalFields.find(field => field.key === metric)!;
  const valueFor = (day: WeekSummary['days'][number]) => metric === 'drinks' ? (day.drinkMl ?? 0) / 1000 : day.totals[metric];
  const hasData = (day: WeekSummary['days'][number]) => metric === 'drinks' ? day.drinkCount > 0 : day.count > 0 && !(metric === 'fiber' && day.fiberIncomplete);
  const target = metric === 'drinks' ? undefined : goals[metric];
  const maximum = Math.max(1, target ?? 0, ...week.days.filter(hasData).map(valueFor));

  return <section className="panel weekly-chart" aria-labelledby={`${id}-title`}>
    <div className="weekly-chart__heading"><h2 id={`${id}-title`}>Tagesvergleich</h2>
      <label htmlFor={`${id}-metric`}>Vergleich<select id={`${id}-metric`} aria-label="Tagesvergleich" value={metric} onChange={event => setMetric(event.target.value as GoalKey | 'drinks')}>
        {goalFields.map(field => <option key={field.key} value={field.key}>{field.label} ({field.unit})</option>)}
        <option value="drinks">Trinkmenge (l)</option>
      </select></label></div>
    <p className="hint">{target !== undefined ? `Gestrichelte Linie: Tagesziel ${fmt(target)} ${field.unit}. ` : ''}Wähle einen Balken, um den Tag zu öffnen.</p>
    <div className="weekly-bars">
      {target !== undefined && <div className="weekly-bars__target" aria-hidden="true" style={{top: `${24 + (1 - target / maximum) * 160}px`}}/>}
      {week.days.map(day => <button key={day.date} type="button" className="weekly-bar" onClick={() => onOpenDay(day.date)}
        aria-label={`${weekDay(day.date, true)}, ${weightDate(day.date)}: ${hasData(day) ? `${fmt(valueFor(day), metric === 'drinks' ? 3 : 1)} ${field.unit}` : metric === 'fiber' && day.fiberIncomplete ? 'Ballaststoffe unvollständig' : metric === 'drinks' ? 'Keine Getränke' : 'Keine Einträge'}. Im Tagebuch öffnen`}>
        <span className="weekly-bar__value">{hasData(day) ? compact(valueFor(day), metric === 'drinks' ? 3 : 1) : '—'}</span>
        <span className={`weekly-bar__track${hasData(day) ? '' : ' weekly-bar__track--empty'}`}>
          {hasData(day) && <span className="weekly-bar__fill" style={{height: `${valueFor(day) / maximum * 100}%`}}/>}
        </span>
        <span className="weekly-bar__day">{weekDay(day.date).replace('.', '')}</span><span className="weekly-bar__date">{day.date.slice(8)}.</span>
      </button>)}
    </div>
    <p className="hint">Werte in {field.unit}. „—“ bedeutet: {metric === 'drinks' ? 'keine Getränke erfasst.' : metric === 'fiber' ? 'keine Einträge oder unvollständige Ballaststoffangaben. Bekannte Nullwerte bleiben als 0 sichtbar.' : 'keine Einträge. Erfasste Werte von 0 bleiben als 0 sichtbar.'}</p>
  </section>;
}
