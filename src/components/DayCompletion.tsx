import {useEffect, useId, useRef, useState} from 'react';
import {getCompletedDays, setDayCompleted} from '../db';
import {germanError} from '../german';
import {weightDate} from '../weight';
import {useToast} from './ToastProvider';
import './DayCompletion.css';

export default function DayCompletion({date, completed, disabled = false, describedBy}: {date: string; completed: boolean; disabled?: boolean; describedBy?: string}) {
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(completed);
  useEffect(() => {setChecked(completed);}, [completed]);
  const saving = useRef(false);
  const notify = useToast();
  return <label className={`day-completion${checked ? ' day-completion--checked' : ''}`}>
    <input type="checkbox" checked={checked} disabled={disabled || busy} aria-describedby={describedBy} aria-label={`Tag vollständig am ${weightDate(date)}`} onChange={async event => {
      if (saving.current) return;
      const next = event.target.checked;
      saving.current = true; setBusy(true); setChecked(next);
      try {await setDayCompleted(date, next); notify(next ? 'Tag als vollständig erfasst markiert.' : 'Markierung für vollständigen Tag entfernt.', 'success');}
      catch (error) {setChecked(completed); notify(germanError(error), 'error');}
      finally {saving.current = false; setBusy(false);}
    }}/><span>Tag vollständig</span>
  </label>;
}

export function DiaryDayCompletion({date}: {date: string}) {
  const [completed, setCompleted] = useState(false), [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const id = useId();
  const notify = useToast();
  useEffect(() => {
    let active = true, request = 0;
    async function load() {
      const current = ++request;
      try {const days = await getCompletedDays(); if (active && current === request) {setCompleted(days.includes(date)); setFailed(false);}}
      catch (error) {if (active && current === request) {setFailed(true); notify(germanError(error), 'error');}}
      finally {if (active && current === request) setLoading(false);}
    }
    setLoading(true); void load();
    window.addEventListener('nutrition-data-changed', load);
    return () => {active = false; window.removeEventListener('nutrition-data-changed', load);};
  }, [date, retry, notify]);
  return <div className="diary-completion">
    <DayCompletion date={date} completed={completed} disabled={loading || failed} describedBy={failed ? undefined : id}/>
    {failed ? <button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>Tagesstatus erneut laden</button> : <small id={id}>{loading ? 'Tagesstatus wird geladen…' : 'Für den Wochenvergleich. Die Markierung kannst du jederzeit ändern.'}</small>}
  </div>;
}
