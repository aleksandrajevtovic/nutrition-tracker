import {useEffect, useState} from 'react';
import {getPlanningData} from '../planningDb';
import {emptyShoppingList} from '../planning';
import {germanError} from '../german';
import {useToast} from '../components/ToastProvider';

export function usePlanningData() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getPlanningData>>>({templates: [], plans: [], shopping: emptyShoppingList()});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const notify = useToast();
  useEffect(() => {
    let active = true, request = 0;
    async function load() {
      const current = ++request;
      try {const values = await getPlanningData(); if (active && current === request) {setData(values); setFailed(false);}}
      catch (error) {if (active && current === request) {setFailed(true); notify(germanError(error), 'error');}}
      finally {if (active && current === request) setLoading(false);}
    }
    void load(); window.addEventListener('nutrition-data-changed', load);
    return () => {active = false; window.removeEventListener('nutrition-data-changed', load);};
  }, [retry, notify]);
  return {...data, loading, failed, reload: () => {setLoading(true); setRetry(value => value + 1);}};
}
