import {useDraftState} from './DraftRecoveryProvider';
import {useId, useRef, useState} from 'react';
import {Check, ChevronDown, FileText, Trash2} from 'lucide-react';
import {getDataRevision, removeDayNote, restoreDeletedDayNote, saveDayNote} from '../db';
import {createDayNote, emptyNoteValues, hasNoteContent, noteFields, type DailyNote} from '../notes';
import {useDayNote} from '../hooks/useDayNote';
import {weightDate} from '../weight';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';
import './DailyNotes.css';

function NoteEditor({date, note, onDeleted}: {date: string; note?: DailyNote; onDeleted: () => void}) {
  const id = useId();
  const [values, setValues] = useDraftState(`DailyNotes:${date}:values`, () => note ? {...note} : emptyNoteValues());
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const notify = useToast();
  const dirty = noteFields.some(key => values[key].trim() !== (note?.[key] ?? ''));
  const guard = useDraftGuard('Tagesnotiz', values, busy, 'day-note');

  async function remove() {
    const revision = getDataRevision();
    const removed = await removeDayNote(date);
    if (removed) notify('Tagesnotiz gelöscht.', 'success', {label: 'Rückgängig', onClick: async () => {
      await restoreDeletedDayNote(removed, revision); notify('Tagesnotiz wiederhergestellt.', 'success');
    }});
    guard.markSaved(); onDeleted();
  }
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true);
    try {await action();} catch (error) {notify(germanError(error), 'error');}
    finally {running.current = false; setBusy(false);}
  }
  return <form className="day-notes__form" onSubmit={event => {event.preventDefault(); void run(async () => {
    const next = createDayNote(date, values);
    if (!next) {if (note) await remove(); return;}
    await saveDayNote(next); guard.markSaved(); notify('Tagesnotiz gespeichert.', 'success');
  });}}>
    <p className="hint">Notizen für {weightDate(date)}. Alle Felder sind optional.</p>
    <div className="day-notes__short-fields"><label htmlFor={`${id}-hunger`}>Hunger<input id={`${id}-hunger`} value={values.hunger} disabled={busy} placeholder="Wie war dein Hungergefühl?" onChange={event => setValues({...values, hunger: event.target.value})}/></label>
      <label htmlFor={`${id}-energy`}>Energie<input id={`${id}-energy`} value={values.energy} disabled={busy} placeholder="Wie hast du dich gefühlt?" onChange={event => setValues({...values, energy: event.target.value})}/></label></div>
    <label htmlFor={`${id}-training`}>Training<textarea id={`${id}-training`} aria-label="Training" value={values.training} disabled={busy} rows={2} placeholder="Training, Bewegung oder Ruhetag" onChange={event => setValues({...values, training: event.target.value})}/></label>
    <label htmlFor={`${id}-observations`}>Eigene Beobachtungen<textarea id={`${id}-observations`} aria-label="Eigene Beobachtungen" value={values.observations} disabled={busy} rows={3} placeholder="Was möchtest du zu diesem Tag festhalten?" onChange={event => setValues({...values, observations: event.target.value})}/></label>
    <p className="hint" role="status">{dirty ? 'Ungespeicherte Änderungen – bitte speichern.' : note ? 'Gespeichert.' : 'Noch keine Notiz gespeichert.'}</p>
    <div className="day-notes__actions"><button className="primary" disabled={busy || !dirty || (!note && !hasNoteContent(values))}><Check size={17}/>{busy ? 'Wird gespeichert…' : 'Notiz speichern'}</button>
      {note && <button type="button" className="secondary" disabled={busy} onClick={() => void run(remove)}><Trash2 size={17}/>Notiz löschen</button>}</div>
  </form>;
}

export default function DailyNotes({date}: {date: string}) {
  const [expanded, setExpanded] = useDraftState(`DailyNotes:${date}:expanded`, false);
  const contentRef = useScrollReveal<HTMLDivElement>(expanded);
  const contentId = useId();
  const data = useDayNote(date);
  const preview = data.note ? noteFields.map(key => data.note![key]).filter(Boolean).join(' · ') : '';
  return <section className="panel day-notes" aria-labelledby="day-notes-title">
    <div className="day-notes__heading"><FileText size={21} aria-hidden="true"/><h2 id="day-notes-title">Tagesnotizen</h2>
      <button type="button" className="secondary" aria-controls={contentId} aria-expanded={expanded} aria-label={expanded ? 'Tagesnotizen einklappen' : data.note ? 'Tagesnotizen bearbeiten' : 'Tagesnotiz hinzufügen'} onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Einklappen' : data.note ? 'Bearbeiten' : 'Hinzufügen'}<ChevronDown size={16} aria-hidden="true"/>
      </button></div>
    {!expanded && <p className="day-notes__preview">{data.loading ? 'Notiz wird geladen…' : data.failed ? 'Notiz konnte nicht geladen werden.' : preview || 'Hunger, Energie, Training oder eigene Beobachtungen festhalten.'}</p>}
    <div ref={contentRef} id={contentId} hidden={!expanded}>{data.loading ? <p className="hint" role="status">Notiz wird geladen…</p> : data.failed ? <button type="button" className="secondary" onClick={data.reload}>Erneut versuchen</button>
      : <NoteEditor key={`${date}-${data.note?.updatedAt ?? 'empty'}`} date={date} note={data.note} onDeleted={() => setExpanded(false)}/>}</div>
  </section>;
}
