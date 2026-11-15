import {useCallback, useEffect, useState} from 'react';
import {getLastBackupExport, recordBackupExport} from '../db';
import {germanError} from '../german';
import {useToast} from '../components/ToastProvider';

export function useBackupStatus() {
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const notify = useToast();
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false);
    getLastBackupExport().then(value => {if (active) setLastExport(value);})
      .catch(error => {if (active) {setFailed(true); notify(germanError(error), 'error');}})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [retry, notify]);

  const recordExport = useCallback(async () => {
    const value = await recordBackupExport();
    setLastExport(value); setFailed(false);
  }, []);
  return {lastExport, loading, failed, recordExport, reload: () => setRetry(value => value + 1)};
}
