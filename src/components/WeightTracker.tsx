import {useEffect, useId, useRef, useState} from 'react';
import {ChevronDown, Pencil, Plus, Scale} from 'lucide-react';
import {useWeightData} from '../hooks/useWeightData';
import {fmt, today} from '../nutrition';
import {weightComparison, weightDate} from '../weight';
import {useNavigationGuard} from './UnsavedChangesProvider';
import WeightEntryForm from './WeightEntryForm';
import WeightChart from './WeightChart';
import './WeightTracker.css';

const delta = (value: number | undefined) => value === undefined ? '—' : `${value > 0 ? '+' : ''}${fmt(value, 3)} kg`;

export default function WeightTracker({date}: {date: string}) {
  const [expanded, setExpanded] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const contentId = useId();
  const formId = useId();
  const entryButton = useRef<HTMLButtonElement>(null);
  const data = useWeightData();
  const confirmNavigation = useNavigationGuard();
  const current = data.records.find(record => record.date === date);
  const comparison = weightComparison(data.records, date);
  const editing = editingDate === date;
  useEffect(() => {setEditingDate(null);}, [date]);
  const closeEditor = () => {setEditingDate(null); entryButton.current?.focus({preventScroll: true});};

  return <section className="panel weight-tracker" aria-labelledby="weight-heading">
    <div className="weight-tracker__heading">
      <Scale size={21} aria-hidden="true"/>
      <div className="weight-tracker__title"><h2 id="weight-heading">Körpergewicht</h2>
        <p className="weight-tracker__compact">{date === today() ? `Heute · ${weightDate(date)}` : weightDate(date)}</p>
      </div>
      <button ref={entryButton} type="button" className={`weight-tracker__entry${current ? ' weight-tracker__entry--recorded' : ''}`}
        disabled={data.loading || data.failed} aria-controls={formId} aria-expanded={editing}
        aria-label={current ? `Gewicht vom ${weightDate(date)} bearbeiten` : 'Gewicht eintragen'}
        onClick={() => {if (editing) {if (confirmNavigation(['weight'])) closeEditor();} else setEditingDate(date);}}>
        {current ? <><strong>{fmt(current.kg, 3)} kg</strong><Pencil size={15} aria-hidden="true"/></> : <><Plus size={16} aria-hidden="true"/>Gewicht eintragen</>}
      </button>
    </div>
    {data.loading && <p className="hint" role="status">Gewichtsdaten werden geladen…</p>}
    {data.failed && <p className="hint">Gewichtsdaten konnten nicht geladen werden. <button type="button" className="secondary" onClick={data.reload}>Erneut versuchen</button></p>}
    <div id={formId}>{editing && !data.loading && !data.failed && <WeightEntryForm key={`${date}-${current?.updatedAt ?? 'new'}`} date={date} record={current}
      suggestion={!current ? comparison.latest : undefined} onSave={data.save} onRemove={data.remove} onClose={closeEditor}/>}</div>
    <button type="button" className="weight-tracker__toggle weight-tracker__history-toggle" aria-expanded={expanded} aria-controls={contentId}
      onClick={() => setExpanded(value => !value)}>
      <span>{expanded ? 'Verlauf ausblenden' : 'Verlauf anzeigen'}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    <div id={contentId} className="weight-tracker__content" hidden={!expanded}>
      {comparison.latest && <div className="weight-stats">
        <div><span>{comparison.latest.date === date ? 'Gewicht am gewählten Tag' : 'Letzte Messung'}</span><strong>{fmt(comparison.latest.kg, 3)} <small>kg</small></strong><small>{weightDate(comparison.latest.date)}</small></div>
        <div><span>Zur vorherigen Messung</span><strong>{delta(comparison.previousChange)}</strong><small>{comparison.previous ? `Vergleich mit ${weightDate(comparison.previous.date)}` : 'Ab der zweiten Messung'}</small></div>
        <div><span>Seit der ersten Messung</span><strong>{delta(comparison.totalChange)}</strong><small>Beginn: {weightDate(comparison.first!.date)}</small></div>
      </div>}
      <WeightChart records={data.records} date={date}/>
    </div>
  </section>;
}
