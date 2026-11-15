import {useId, useState} from 'react';
import {Check, ChevronDown, Scale, Trash2} from 'lucide-react';
import {useWeightData} from '../hooks/useWeightData';
import {germanError} from '../german';
import {fmt} from '../nutrition';
import {parseWeight, weightComparison, weightDate, type WeightRecord} from '../weight';
import {useToast} from './ToastProvider';
import WeightChart from './WeightChart';
import {useDraftGuard} from './UnsavedChangesProvider';
import './WeightTracker.css';

function WeightForm({date, record, onSave, onRemove}: {
  date: string; record?: WeightRecord;
  onSave: (date: string, kg: number) => Promise<void>; onRemove: (date: string) => Promise<void>;
}) {
  const [value, setValue] = useState(record ? String(record.kg).replace('.', ',') : '');
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  const parsed = parseWeight(value);
  const guard = useDraftGuard('Gewichtseintrag', Number.isFinite(parsed) ? parsed : value, busy, 'weight');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const kg = parseWeight(value);
    if (!Number.isFinite(kg) || kg <= 0) {notify('Bitte ein gültiges Gewicht über 0 kg eingeben.', 'error'); return;}
    setBusy(true);
    try {await onSave(date, kg); guard.markSaved();} catch (error) {notify(germanError(error), 'error');}
    finally {setBusy(false);}
  }
  async function remove() {
    if (busy || !confirm(`Gewichtseintrag vom ${weightDate(date)} löschen?`)) return;
    setBusy(true);
    try {await onRemove(date); guard.markSaved();} catch (error) {notify(germanError(error), 'error');}
    finally {setBusy(false);}
  }

  return <form className="weight-form" onSubmit={save}>
    <label htmlFor="daily-weight">Gewicht am {weightDate(date)}</label>
    <div className="weight-form__fields"><div className="weight-form__input">
      <input id="daily-weight" type="text" inputMode="decimal" autoComplete="off" required placeholder="z. B. 72,5"
        value={value} disabled={busy} onChange={event => setValue(event.target.value)} aria-describedby="weight-unit"/>
      <span id="weight-unit">kg</span>
    </div>
      <button className="primary" disabled={busy}><Check size={17}/>{busy ? 'Wird gespeichert…' : record ? 'Aktualisieren' : 'Speichern'}</button>
      {record && <button type="button" className="weight-form__delete" aria-label="Gewichtseintrag löschen" title="Gewichtseintrag löschen" disabled={busy} onClick={remove}><Trash2 size={17}/></button>}
    </div>
    <p className="hint">Ein Wert pro Tag. Wähle oben ein anderes Datum, um frühere Messungen einzutragen oder zu bearbeiten.</p>
  </form>;
}

const delta = (value: number | undefined) => value === undefined ? '—' : `${value > 0 ? '+' : ''}${fmt(value, 3)} kg`;

export default function WeightTracker({date}: {date: string}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const data = useWeightData();
  const current = data.records.find(record => record.date === date);
  const comparison = weightComparison(data.records, date);

  return <section className="panel weight-tracker" aria-labelledby="weight-heading">
    <div className="weight-tracker__heading">
      <Scale size={21} aria-hidden="true"/>
      <div className="weight-tracker__title"><span className="eyebrow">DEIN VERLAUF</span><h2 id="weight-heading">Körpergewicht</h2>
        {!expanded && <p className="weight-tracker__compact">
          {data.loading ? 'Wird geladen…' : data.failed ? 'Laden fehlgeschlagen' : comparison.latest
            ? <><strong>{fmt(comparison.latest.kg, 3)} kg</strong><span>{comparison.latest.date === date ? 'Gewählter Tag' : 'Letzte Messung'} · {weightDate(comparison.latest.date)}</span></>
            : 'Noch kein Gewicht eingetragen'}
        </p>}
      </div>
      <button type="button" className="weight-tracker__toggle" aria-expanded={expanded} aria-controls={contentId}
        aria-label={expanded ? 'Gewichtsbereich einklappen' : 'Gewichtsbereich aufklappen'} onClick={() => setExpanded(value => !value)}>
        <span>{expanded ? 'Einklappen' : 'Aufklappen'}</span><ChevronDown size={18} aria-hidden="true"/>
      </button>
    </div>
    <div id={contentId} className="weight-tracker__content" hidden={!expanded}>
    {data.loading ? <p className="hint" role="status">Gewichtsdaten werden geladen…</p> : data.failed ? <>
      <p>Gewichtsdaten konnten nicht geladen werden.</p><button className="secondary" onClick={data.reload}>Erneut versuchen</button>
    </> : <>
      <WeightForm key={`${date}-${current?.updatedAt ?? 'new'}`} date={date} record={current} onSave={data.save} onRemove={data.remove}/>
      {comparison.latest && <div className="weight-stats">
        <div><span>{comparison.latest.date === date ? 'Gewicht am gewählten Tag' : 'Letzte Messung'}</span><strong>{fmt(comparison.latest.kg, 3)} <small>kg</small></strong><small>{weightDate(comparison.latest.date)}</small></div>
        <div><span>Zur vorherigen Messung</span><strong>{delta(comparison.previousChange)}</strong><small>{comparison.previous ? `Vergleich mit ${weightDate(comparison.previous.date)}` : 'Ab der zweiten Messung'}</small></div>
        <div><span>Seit der ersten Messung</span><strong>{delta(comparison.totalChange)}</strong><small>Beginn: {weightDate(comparison.first!.date)}</small></div>
      </div>}
      <WeightChart records={data.records} date={date}/>
    </>}
    </div>
  </section>;
}
