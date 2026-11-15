import {useId, useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {useScrollReveal} from '../hooks/useScrollReveal';
import WeightTracker from './WeightTracker';
import HydrationTracker from './HydrationTracker';
import DailyNotes from './DailyNotes';
import './DailyExtras.css';

export default function DailyExtras({date}: {date: string}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const content = useScrollReveal<HTMLDivElement>(expanded);
  return <section className="diary-extras" aria-label="Weitere Tagesdaten">
    <button type="button" className="diary-extras__toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <span><strong>Weitere Tagesdaten</strong><small>Gewicht, Trinkmenge und Notizen</small></span><ChevronDown size={17} aria-hidden="true"/>
    </button>
    <div ref={content} id={id} className="diary-extras__content" hidden={!expanded}>
      <WeightTracker date={date}/>
      <HydrationTracker key={`hydration-${date}`} date={date}/>
      <DailyNotes key={`notes-${date}`} date={date}/>
    </div>
  </section>;
}
