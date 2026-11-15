import {useEffect, useState} from 'react';
import {getPeriodData} from '../db';
import {calendarWeek, shiftDate} from '../week';
import {germanError} from '../german';
import {useToast} from '../components/ToastProvider';

type PeriodData = Awaited<ReturnType<typeof getPeriodData>>;

export function useWeekData(date: string) {
  const {start, end} = calendarWeek(date);
  const [data, setData] = useState<PeriodData>({entries: [], weights: [], goals: {}, drinks: [], dailyNotes: []});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const notify = useToast();
  useEffect(() => {
    let active = true;
    let request = 0;
    async function load() {
      const current = ++request;
      setLoading(true); setFailed(false);
      try {
        const values = await getPeriodData(shiftDate(start, -7), end);
        if (active && current === request) setData(values);
      } catch (error) {
        if (active && current === request) {setFailed(true); notify(germanError(error), 'error');}
      } finally {if (active && current === request) setLoading(false);}
    }
    void load();
    window.addEventListener('nutrition-data-changed', load);
    window.addEventListener('nutrition-notes-changed', load);
    return () => {active = false; window.removeEventListener('nutrition-data-changed', load); window.removeEventListener('nutrition-notes-changed', load);};
  }, [start, end, retry, notify]);
  return {...data, loading, failed, reload: () => setRetry(value => value + 1)};
}
