import {useCallback, useEffect, useState} from 'react';
import {listDiaryHistory, type Entry} from '../db';

export function useDiaryHistory() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{entries: Entry[]; loading: boolean; failed: boolean}>({entries: [], loading: true, failed: false});
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    window.addEventListener('nutrition-data-changed', reload);
    return () => window.removeEventListener('nutrition-data-changed', reload);
  }, [reload]);
  useEffect(() => {
    let cancelled = false;
    setState(previous => ({...previous, loading: true, failed: false}));
    listDiaryHistory().then(entries => {if (!cancelled) setState({entries, loading: false, failed: false});})
      .catch(() => {if (!cancelled) setState({entries: [], loading: false, failed: true});});
    return () => {cancelled = true;};
  }, [revision]);
  return {...state, reload};
}
