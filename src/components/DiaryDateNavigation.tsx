import {CalendarDays, ChevronLeft, ChevronRight} from 'lucide-react';
import {today} from '../nutrition';
import {shiftDate} from '../week';
import {validDate} from '../weight';
import './DiaryDateNavigation.css';

export default function DiaryDateNavigation({date, onChange}: {date: string; onChange: (date: string) => void}) {
  const current = today(), yesterday = shiftDate(current, -1);
  const previous = shiftDate(date, -1), next = shiftDate(date, 1);
  const supported = (value: string) => validDate(value) && value >= '0001-01-01' && value <= '9999-12-31';
  return <div className="diary-date-navigation" role="group" aria-label="Tag auswählen">
    <div className="diary-date-navigation__calendar">
      <button type="button" className="iconbtn" aria-label="Vorheriger Tag" title="Vorheriger Tag" disabled={!supported(previous)} onClick={() => onChange(previous)}><ChevronLeft size={19} aria-hidden="true"/></button>
      <label className="date"><CalendarDays size={17} aria-hidden="true"/><input aria-label="Datum" type="date" required min="0001-01-01" max="9999-12-31" value={date} onChange={event => {if (supported(event.target.value)) onChange(event.target.value);}}/></label>
      <button type="button" className="iconbtn" aria-label="Nächster Tag" title="Nächster Tag" disabled={!supported(next)} onClick={() => onChange(next)}><ChevronRight size={19} aria-hidden="true"/></button>
    </div>
    <div className="diary-date-navigation__shortcuts">
      <button type="button" aria-pressed={date === yesterday} onClick={() => onChange(shiftDate(today(), -1))}>Gestern</button>
      <button type="button" aria-pressed={date === current} onClick={() => onChange(today())}>Heute</button>
    </div>
  </div>;
}
