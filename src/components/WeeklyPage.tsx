import {useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {fmt, today} from '../nutrition';
import {goalFields} from '../goals';
import {calendarWeek, shiftDate, summarizeWeek, weekDay} from '../week';
import {validDate, weightDate} from '../weight';
import {useWeekData} from '../hooks/useWeekData';
import WeeklyNutritionChart from './WeeklyNutritionChart';
import WeightChart from './WeightChart';
import './WeightTracker.css';
import './WeeklyPage.css';

const change = (value: number, unit: string, digits = 1) => `${value > 0 ? '+' : ''}${fmt(value, digits)} ${unit}`;

export default function WeeklyPage({date, onOpenDay}: {date: string; onOpenDay: (date: string) => void}) {
  const [anchor, setAnchor] = useState(date);
  const range = calendarWeek(anchor);
  const data = useWeekData(anchor);
  const week = summarizeWeek(data.entries, data.weights, anchor, data.drinks);
  const previous = summarizeWeek(data.entries, data.weights, shiftDate(range.start, -7), data.drinks);
  const measurements = data.weights.filter(record => record.date >= range.start && record.date <= range.end);

  return <>
    <div className="heading"><div><span className="eyebrow">DEINE WOCHE IM BLICK</span><h1>Wochenübersicht</h1></div>
      <button type="button" className="secondary" onClick={() => setAnchor(today())}>Diese Woche</button></div>
    <section className="panel week-picker" aria-label="Woche auswählen">
      <div className="week-picker__navigation"><button type="button" className="iconbtn" aria-label="Vorherige Woche" onClick={() => setAnchor(shiftDate(range.start, -7))}><ChevronLeft size={20}/></button>
        <div aria-live="polite"><strong>KW {range.number} · {range.year}</strong><span>{weightDate(range.start)} – {weightDate(range.end)}</span></div>
        <button type="button" className="iconbtn" aria-label="Nächste Woche" onClick={() => setAnchor(shiftDate(range.start, 7))}><ChevronRight size={20}/></button></div>
      <label className="week-picker__date">Datum in der Woche<input type="date" required value={anchor} onChange={event => {if (validDate(event.target.value)) setAnchor(event.target.value);}}/></label>
    </section>
    {data.loading ? <p className="hint" role="status">Wochendaten werden geladen…</p> : data.failed ? <section className="panel"><p>Die Wochenübersicht konnte nicht geladen werden.</p><button type="button" className="secondary" onClick={data.reload}>Erneut versuchen</button></section> : <>
      <div className="weekly-averages">{goalFields.map(({key, label, unit}) => <article className="panel weekly-average" key={key}>
        <span>Ø {label}</span><strong>{week.averages ? `${fmt(week.averages[key])} ${unit}` : '—'}</strong>
        <small>{week.averages && previous.averages ? `${change(Number((week.averages[key] - previous.averages[key]).toFixed(3)), unit)} zur Vorwoche (Ø)` : 'Noch kein Vergleich zur Vorwoche'}</small>
      </article>)}<article className="panel weekly-average"><span>Ø Gewicht</span><strong>{week.weightAverage === undefined ? '—' : `${fmt(week.weightAverage, 2)} kg`}</strong>
        <small>{week.weightAverage !== undefined && previous.weightAverage !== undefined ? `${change(Number((week.weightAverage - previous.weightAverage).toFixed(3)), 'kg')} zur Vorwoche (Ø)` : `${week.measuredDays} ${week.measuredDays === 1 ? 'Messung' : 'Messungen'} in dieser Woche`}</small></article>
        <article className="panel weekly-average weekly-average--drinks"><span>Ø Trinkmenge</span><strong>{week.drinkAverageMl === undefined ? '—' : `${fmt(week.drinkAverageMl / 1000, 3)} l`}</strong>
          <small>{week.drinkingDays ? `${fmt(week.drinkTotalMl / 1000, 3)} l insgesamt · ${week.drinkingDays} ${week.drinkingDays === 1 ? 'Tag' : 'Tage'} mit Getränken` : 'Noch keine Getränke in dieser Woche'}</small>
          <small>{week.drinkAverageMl !== undefined && previous.drinkAverageMl !== undefined ? `${change(Number(((week.drinkAverageMl - previous.drinkAverageMl) / 1000).toFixed(3)), 'l', 3)} zur Vorwoche (Ø)` : 'Noch kein Vergleich zur Vorwoche'}</small>
        </article></div>
      <p className="hint weekly-method">Nährwert-Durchschnitt aus {week.recordedDays} {week.recordedDays === 1 ? 'Tag' : 'Tagen'} mit Lebensmitteln, Gewicht aus {week.measuredDays} {week.measuredDays === 1 ? 'Messung' : 'Messungen'}, Trinkmenge aus {week.drinkingDays} {week.drinkingDays === 1 ? 'Tag' : 'Tagen'} mit Getränken. Vorwoche: {previous.recordedDays} Ernährungstage, {previous.measuredDays} Gewichtsmessungen und {previous.drinkingDays} Tage mit Getränken. Tage ohne Daten werden nicht als 0 gewertet. Teilweise erfasste Tage zählen mit.</p>
      <div className="weekly-charts"><WeeklyNutritionChart week={week} goals={data.goals} onOpenDay={onOpenDay}/>
        <section className="panel weekly-weight"><WeightChart records={measurements} date={range.end} showRanges={false}/>
          {week.weightChange !== undefined && <p className="hint">Änderung zwischen erster und letzter Messung dieser Woche: <strong>{change(week.weightChange, 'kg')}</strong></p>}
        </section></div>
      <section className="weekly-days" aria-labelledby="weekly-days-title"><div className="section-head"><h2 id="weekly-days-title">Tageswerte</h2></div>
        <div className="weekly-days__grid">{week.days.map(day => <article className="panel weekly-day" key={day.date}>
          <div className="weekly-day__heading"><button type="button" onClick={() => onOpenDay(day.date)} aria-label={`${weightDate(day.date)} im Tagebuch öffnen`}>
            <strong>{weekDay(day.date, true)}</strong><span>{weightDate(day.date)}{day.date === today() ? ' · Heute' : ''}</span></button>
            <small>{day.count ? `${day.count} ${day.count === 1 ? 'Eintrag' : 'Einträge'}` : 'Keine Lebensmittel'}{day.drinkCount ? ` · ${day.drinkCount} ${day.drinkCount === 1 ? 'Getränk' : 'Getränke'}` : ''}</small></div>
          <dl>{goalFields.map(({key, label, unit}) => <div key={key}><dt>{label}</dt><dd>{day.count ? `${fmt(day.totals[key])} ${unit}` : '—'}</dd></div>)}
            <div><dt>Gewicht</dt><dd>{day.weight === undefined ? '—' : `${fmt(day.weight, 2)} kg`}</dd></div>
            <div><dt>Trinkmenge</dt><dd>{day.drinkMl === undefined ? '—' : `${fmt(day.drinkMl / 1000, 3)} l`}</dd></div></dl>
        </article>)}</div>
      </section>
    </>}
  </>;
}
