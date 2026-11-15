import {useEffect, useState} from 'react';
import {getDayNote} from '../db';
import type {DailyNote} from '../notes';
import {germanError} from '../german';
import {useToast} from '../components/ToastProvider';

export function useDayNote(date: string) {
  const [note, setNote] = useState<DailyNote>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const notify = useToast();
  useEffect(() => {
    let active = true, request = 0;
    async function load() {
      const current = ++request;
      try {const value = await getDayNote(date); if (active && current === request) {setNote(value); setFailed(false);}}
      catch (error) {if (active && current === request) {setFailed(true); notify(germanError(error), 'error');}}
      finally {if (active && current === request) setLoading(false);}
    }
    void load(); window.addEventListener('nutrition-notes-changed', load);
    return () => {active = false; window.removeEventListener('nutrition-notes-changed', load);};
  }, [date, retry, notify]);
  return {note, loading, failed, reload: () => {setLoading(true); setRetry(value => value + 1);}};
}
