import {useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {fmt, today} from '../nutrition';
import {goalFields} from '../goals';
import {calendarWeek, shiftDate, summarizeWeek} from '../week';
import {validDate, weightDate} from '../weight';
import {useWeekData} from '../hooks/useWeekData';
import WeeklyNutritionChart from './WeeklyNutritionChart';
import WeightChart from './WeightChart';
import {useToast} from './ToastProvider';
import WeeklyDayCard from './WeeklyDayCard';
import './WeightTracker.css';
import './WeeklyPage.css';

const change = (value: number, unit: string, digits = 1) => `${value > 0 ? '+' : ''}${fmt(value, digits)} ${unit}`;

export default function WeeklyPage({date, onOpenDay}: {date: string; onOpenDay: (date: string) => void}) {
  const [anchor, setAnchor] = useState(date);
  const preferenceKey = 'nutrition-tracker:completed-week-average';
  const [onlyCompleted, setOnlyCompleted] = useState(() => {
    try {return localStorage.getItem(preferenceKey) === 'true';} catch {return false;}
  });
  const notify = useToast();
  const range = calendarWeek(anchor);
  const data = useWeekData(anchor);
  const options = {completedDays: data.completedDays, onlyCompleted};
  const week = summarizeWeek(data.entries, data.weights, anchor, data.drinks, options);
  const previous = summarizeWeek(data.entries, data.weights, shiftDate(range.start, -7), data.drinks, options);
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
      <section className="panel week-average-filter" aria-label="Berechnung der Nährwertdurchschnitte">
        <label><input type="checkbox" checked={onlyCompleted} aria-describedby="week-average-hint" onChange={event => {
          const next = event.target.checked; setOnlyCompleted(next);
          try {localStorage.setItem(preferenceKey, String(next));}
          catch {notify('Die Auswahl konnte für den nächsten Besuch nicht gespeichert werden.', 'error');}
        }}/>Nur vollständige Tage im Nährwertdurchschnitt</label>
        <p className="hint" id="week-average-hint">Gilt auch für den Vergleich zur Vorwoche. Gewicht, Trinkmenge und Tageswerte berücksichtigen weiterhin alle erfassten Daten.</p>
        {onlyCompleted && !week.averagedDays && <p className="hint" role="status">Noch kein vollständig erfasster Tag mit Lebensmitteln in dieser Woche. Markiere einen Tag als vollständig oder schalte den Filter aus.</p>}
      </section>
      <div className="weekly-averages">{goalFields.map(({key, label, unit}) => <article className="panel weekly-average" key={key}>
        <span>Ø {label}</span><strong>{week.averages ? key === 'fiber' && week.fiberIncomplete ? 'Unvollständig' : `${fmt(week.averages[key])} ${unit}` : '—'}</strong>
        <small>{key === 'fiber' && (week.fiberIncomplete || previous.fiberIncomplete) ? 'Fehlende Ballaststoffangaben – kein vollständiger Vergleich' : week.averages && previous.averages ? `${change(Number((week.averages[key] - previous.averages[key]).toFixed(3)), unit)} zur Vorwoche (Ø)` : 'Noch kein Vergleich zur Vorwoche'}</small>
      </article>)}<article className="panel weekly-average"><span>Ø Gewicht</span><strong>{week.weightAverage === undefined ? '—' : `${fmt(week.weightAverage, 2)} kg`}</strong>
        <small>{week.weightAverage !== undefined && previous.weightAverage !== undefined ? `${change(Number((week.weightAverage - previous.weightAverage).toFixed(3)), 'kg')} zur Vorwoche (Ø)` : `${week.measuredDays} ${week.measuredDays === 1 ? 'Messung' : 'Messungen'} in dieser Woche`}</small></article>
        <article className="panel weekly-average weekly-average--drinks"><span>Ø Trinkmenge</span><strong>{week.drinkAverageMl === undefined ? '—' : `${fmt(week.drinkAverageMl / 1000, 3)} l`}</strong>
          <small>{week.drinkingDays ? `${fmt(week.drinkTotalMl / 1000, 3)} l insgesamt · ${week.drinkingDays} ${week.drinkingDays === 1 ? 'Tag' : 'Tage'} mit Getränken` : 'Noch keine Getränke in dieser Woche'}</small>
          <small>{week.drinkAverageMl !== undefined && previous.drinkAverageMl !== undefined ? `${change(Number(((week.drinkAverageMl - previous.drinkAverageMl) / 1000).toFixed(3)), 'l', 3)} zur Vorwoche (Ø)` : 'Noch kein Vergleich zur Vorwoche'}</small>
        </article></div>
      <p className="hint weekly-method">Nährwert-Durchschnitt aus {week.averagedDays} {onlyCompleted ? 'vollständig erfassten ' : ''}{week.averagedDays === 1 ? 'Tag' : 'Tagen'} mit Lebensmitteln, Gewicht aus {week.measuredDays} {week.measuredDays === 1 ? 'Messung' : 'Messungen'}, Trinkmenge aus {week.drinkingDays} {week.drinkingDays === 1 ? 'Tag' : 'Tagen'} mit Getränken. Vorwoche: {previous.averagedDays} {onlyCompleted ? 'vollständig erfasste ' : ''}Ernährungstage, {previous.measuredDays} Gewichtsmessungen und {previous.drinkingDays} Tage mit Getränken. Tage ohne Daten werden nicht als 0 gewertet. {onlyCompleted ? 'Nicht als vollständig markierte Tage zählen im Nährwertdurchschnitt nicht mit.' : 'Teilweise erfasste Tage zählen mit.'}</p>
      <div className="weekly-charts"><WeeklyNutritionChart week={week} goals={data.goals} onOpenDay={onOpenDay}/>
        <section className="panel weekly-weight"><WeightChart records={measurements} date={range.end} showRanges={false}/>
          {week.weightChange !== undefined && <p className="hint">Änderung zwischen erster und letzter Messung dieser Woche: <strong>{change(week.weightChange, 'kg')}</strong></p>}
        </section></div>
      <section className="weekly-days" aria-labelledby="weekly-days-title"><div className="section-head"><h2 id="weekly-days-title">Tageswerte</h2></div>
        <div className="weekly-days__grid">{week.days.map(day => <WeeklyDayCard key={day.date} day={day} note={data.dailyNotes.find(note => note.date === day.date)} onOpenDay={onOpenDay}/>)}</div>
      </section>
    </>}
  </>;
}
