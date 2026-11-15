import {useEffect, useState} from 'react';
import {listDrinks} from '../db';
import type {Drink} from '../hydration';

export function useHydration(date: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{drinks: Drink[]; loading: boolean; failed: boolean}>({drinks: [], loading: true, failed: false});
  useEffect(() => {
    let active = true, request = 0;
    const load = async () => {
      const current = ++request;
      try {const drinks = await listDrinks(date); if (active && request === current) setState({drinks, loading: false, failed: false});}
      catch {if (active && request === current) setState({drinks: [], loading: false, failed: true});}
    };
    setState({drinks: [], loading: true, failed: false});
    void load(); window.addEventListener('nutrition-data-changed', load);
    return () => {active = false; window.removeEventListener('nutrition-data-changed', load);};
  }, [date, revision]);
  return {...state, reload: () => setRevision(value => value + 1)};
}
