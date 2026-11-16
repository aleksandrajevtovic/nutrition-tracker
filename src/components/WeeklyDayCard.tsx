import {useEffect, useId, useRef, useState} from 'react';
import {FileText, X} from 'lucide-react';
import type {DailyNote} from '../notes';
import {noteFields} from '../notes';
import {goalFields} from '../goals';
import {fmt, today} from '../nutrition';
import {weekDay, type WeekSummary} from '../week';
import {weightDate} from '../weight';
import {useScrollReveal} from '../hooks/useScrollReveal';
import './WeeklyDayCard.css';

const labels = {hunger: 'Hunger', energy: 'Energie', training: 'Training', observations: 'Eigene Beobachtungen'};

export default function WeeklyDayCard({day, note, onOpenDay}: {
  day: WeekSummary['days'][number]; note?: DailyNote; onOpenDay: (date: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const content = useScrollReveal<HTMLDivElement>(expanded && Boolean(note));
  useEffect(() => {if (!note) setExpanded(false);}, [note]);

  return <article className="panel weekly-day">
    <div className="weekly-day__heading"><div className="weekly-day__date">
      <button type="button" onClick={() => onOpenDay(day.date)} aria-label={`${weightDate(day.date)} im Tagebuch öffnen`}>
        <strong>{weekDay(day.date, true)}</strong><span>{weightDate(day.date)}{day.date === today() ? ' · Heute' : ''}</span></button>
      {note && <button ref={toggle} type="button" className="weekly-note-toggle" aria-expanded={expanded} aria-controls={id}
        aria-label={`Tagesnotiz vom ${weightDate(day.date)} ${expanded ? 'einklappen' : 'anzeigen'}`} title="Tagesnotiz vorhanden" onClick={() => setExpanded(value => !value)}><FileText size={18} aria-hidden="true"/></button>}
    </div><small>{day.count ? `${day.count} ${day.count === 1 ? 'Eintrag' : 'Einträge'}` : 'Keine Lebensmittel'}{day.drinkCount ? ` · ${day.drinkCount} ${day.drinkCount === 1 ? 'Getränk' : 'Getränke'}` : ''}</small></div>
    <dl>{goalFields.map(({key, label, unit}) => <div key={key}><dt>{label}</dt><dd>{day.count ? key === 'fiber' && day.fiberIncomplete ? 'Unvollständig' : `${fmt(day.totals[key])} ${unit}` : '—'}</dd></div>)}
      <div><dt>Gewicht</dt><dd>{day.weight === undefined ? '—' : `${fmt(day.weight, 2)} kg`}</dd></div>
      <div><dt>Trinkmenge</dt><dd>{day.drinkMl === undefined ? '—' : `${fmt(day.drinkMl / 1000, 3)} l`}</dd></div></dl>
    {note && <div ref={content} id={id} className="weekly-day-note" hidden={!expanded}>
      <div className="weekly-day-note__heading"><h3>Tagesnotiz vom {weightDate(day.date)}</h3><button type="button" className="iconbtn" aria-label="Tagesnotiz schließen" onClick={() => {setExpanded(false); toggle.current?.focus({preventScroll: true});}}><X size={17}/></button></div>
      <dl>{noteFields.map(key => <div key={key}><dt>{labels[key]}</dt><dd>{note[key].trim() ? note[key] : 'Nicht notiert'}</dd></div>)}</dl>
    </div>}
  </article>;
}
