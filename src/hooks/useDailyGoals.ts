import {useCallback, useEffect, useState} from 'react';
import {getDailyGoals, saveDailyGoals} from '../db';
import type {DailyGoals} from '../goals';
import {germanError} from '../german';
import {useToast} from '../components/ToastProvider';

export function useDailyGoals() {
  const [goals, setGoals] = useState<DailyGoals>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const notify = useToast();
  const reload = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {setGoals(await getDailyGoals());}
    catch (error) {setFailed(true); notify(germanError(error), 'error');}
    finally {setLoading(false);}
  }, [notify]);
  useEffect(() => {void reload();}, [reload]);
  return {goals, loading, failed, reload, save: async (next: DailyGoals) => {
    await saveDailyGoals(next); setGoals(next);
    notify(Object.keys(next).length ? 'Tagesziele erfolgreich gespeichert.' : 'Tagesziele entfernt.', 'success');
  }};
}
