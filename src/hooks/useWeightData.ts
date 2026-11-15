import {useCallback, useEffect, useState} from 'react';
import {getDataRevision, listWeights, removeWeight, restoreDeletedWeight, saveWeight} from '../db';
import {germanError} from '../german';
import {useToast} from '../components/ToastProvider';
import type {WeightRecord} from '../weight';

export function useWeightData() {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const notify = useToast();
  const reload = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {setRecords(await listWeights());}
    catch (error) {setFailed(true); notify(germanError(error), 'error');}
    finally {setLoading(false);}
  }, [notify]);

  useEffect(() => {
    void reload();
    const updated = () => {listWeights().then(setRecords).catch(error => notify(germanError(error), 'error'));};
    window.addEventListener('nutrition-weights-changed', updated);
    return () => window.removeEventListener('nutrition-weights-changed', updated);
  }, [reload, notify]);

  return {
    records, loading, failed, reload,
    save: async (date: string, kg: number) => {
      const existing = records.some(record => record.date === date);
      await saveWeight({date, kg, updatedAt: new Date().toISOString()});
      setRecords(await listWeights());
      notify(existing ? 'Gewicht erfolgreich aktualisiert.' : 'Gewicht erfolgreich gespeichert.', 'success');
    },
    remove: async (date: string) => {
      const revision = getDataRevision();
      const deleted = await removeWeight(date);
      setRecords(await listWeights());
      if (deleted) notify('Gewichtseintrag erfolgreich gelöscht.', 'success', {label: 'Rückgängig', onClick: async () => {
        await restoreDeletedWeight(deleted, revision);
        window.dispatchEvent(new Event('nutrition-weights-changed'));
        notify('Gewichtseintrag wiederhergestellt.', 'success');
      }});
    },
  };
}
