import {germanError} from '../german';
import {useCallback, useEffect, useRef, useState} from 'react';
import {copyMealEntries, listEntries, listFoods, removeEntry, removeFood, saveFood, toggleFoodFavorite, type Entry, type Food} from '../db';
import {getDataRevision, restoreDeletedEntry, restoreDeletedFood} from '../db';
import {changeEntryAmountWithUndo, requestEntryEditUndo, saveEntryWithUndo, undoEntryEdit, type EntryEdit} from '../entryEdits';
import {weightDate} from '../weight';
import {useToast} from '../components/ToastProvider';
import {transferEntry as performEntryTransfer, undoEntryTransfer, type TransferEntry} from '../entryTransfer';

export function useNutritionData(date: string) {
  const notify = useToast();
  const [foods, setFoods] = useState<Food[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setErrorMessage] = useState('');
  const setError = useCallback((message: string) => {
    setErrorMessage(message);
    notify(message, 'error');
  }, [notify]);
  const activeDate = useRef(date);
  activeDate.current = date;
  const refreshFoods = useCallback(async () => setFoods(await listFoods()), []);
  const refreshEntries = useCallback(async () => {
    const requestedDate = activeDate.current;
    const values = await listEntries(requestedDate);
    if (activeDate.current === requestedDate) setEntries(values);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listFoods().then(values => {if (!cancelled) {setFoods(values); setReady(true);}})
      .catch(e => {if (!cancelled) setError(germanError(e));});
    return () => {cancelled = true;};
  }, [setError]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setEntries([]);
    listEntries(date).then(values => {if (!cancelled) setEntries(values);})
      .catch(e => {if (!cancelled) setError(germanError(e));});
    return () => {cancelled = true;};
  }, [date, ready, setError]);
  useEffect(() => {
    if (!ready) return;
    const updated = () => {void refreshEntries().catch(error => setError(germanError(error)));};
    window.addEventListener('nutrition-diary-changed', updated);
    return () => window.removeEventListener('nutrition-diary-changed', updated);
  }, [ready, refreshEntries, setError]);

  const undoAction = (change?: EntryEdit) => change ? {label: 'Rückgängig', onClick: async () => {
    if (!requestEntryEditUndo(change.before)) return false;
    await undoEntryEdit(change);await refreshEntries().catch(error => setError(germanError(error)));
    notify('Änderung am Eintrag rückgängig gemacht.', 'success');
  }} : undefined;

  return {
    foods, entries, ready, error,
    reload: async () => {await refreshFoods(); await refreshEntries();},
    toggleFavorite: async (id: string) => {
      const food = await toggleFoodFavorite(id);
      await refreshFoods();
      notify(food.favorite ? 'Zu Favoriten hinzugefügt.' : 'Aus Favoriten entfernt.', 'success');
    },
    copyMeal: async (sourceDate: string, sourceMeal: string, targetDate: string, targetMeal: string) => {
      const copied = await copyMealEntries(sourceDate, sourceMeal, targetDate, targetMeal);
      await refreshEntries();
      notify(`${copied.length} ${copied.length === 1 ? 'Eintrag' : 'Einträge'} nach „${targetMeal}“ am ${weightDate(targetDate)} kopiert.`, 'success');
    },
    persistFood: async (food: Food) => {
      const existing = foods.some(f => f.id === food.id);
      await saveFood(food); await refreshFoods();
      notify(food.recipe ? (existing ? 'Rezept erfolgreich bearbeitet.' : 'Rezept erfolgreich gespeichert.')
        : (existing ? 'Lebensmittel erfolgreich bearbeitet.' : 'Lebensmittel erfolgreich hinzugefügt.'), 'success');
    },
    deleteFood: async (food: Food) => {
      if (!confirm(`„${food.name}“ löschen? Bereits gespeicherte Tagebucheinträge bleiben erhalten.`)) return;
      try {
        const revision = getDataRevision();
        const deleted = await removeFood(food.id); await refreshFoods();
        if (deleted) notify('Lebensmittel erfolgreich gelöscht.', 'success', {label: 'Rückgängig', onClick: async () => {
          await restoreDeletedFood(deleted, revision); await refreshFoods();
          notify('Lebensmittel wiederhergestellt.', 'success');
        }});
      } catch (e) {setError(germanError(e));}
    },
    persistEntry: async (entry: Entry, conversions: Partial<Food>) => {
      const currentFood = foods.find(f => f.id === entry.foodId);
      if (currentFood && Object.keys(conversions).length) {
        await saveFood({...currentFood, ...conversions}); await refreshFoods();
      }
      const result = await saveEntryWithUndo(entry);
      await refreshEntries().catch(error => setError(germanError(error)));
      notify(result.change ? 'Eintrag erfolgreich bearbeitet.' : entries.some(value => value.id === entry.id) ? 'Eintrag erfolgreich gespeichert.' : 'Eintrag erfolgreich hinzugefügt.', 'success', undoAction(result.change));
    },
    persistQuantity: async (id: string, amount: number) => {
      const result = await changeEntryAmountWithUndo(id, amount);
      await refreshEntries().catch(error => setError(germanError(error)));
      notify('Menge aktualisiert.', 'success', undoAction(result.change));
      return result.entry;
    },
    transferEntry: (async (source, targetDate, targetMeal, mode) => {
      const result=await performEntryTransfer(source,targetDate,targetMeal,mode);
      await refreshEntries().catch(error=>setError(germanError(error)));
      notify(`„${source.foodSnapshot.name}“ nach „${result.after.meal}“ am ${weightDate(result.after.date)} ${mode==='copy' ? 'kopiert' : 'verschoben'}.`,'success',{label:'Rückgängig',onClick:async()=>{
        await undoEntryTransfer(result);await refreshEntries();notify(mode==='copy' ? 'Kopie rückgängig gemacht.' : 'Verschieben rückgängig gemacht.','success');
      }});
      return result.after;
    }) satisfies TransferEntry,
    deleteEntry: async (id: string) => {
      try {
        const revision = getDataRevision();
        const deleted = await removeEntry(id); await refreshEntries();
        if (deleted) notify('Eintrag erfolgreich gelöscht.', 'success', {label: 'Rückgängig', onClick: async () => {
          await restoreDeletedEntry(deleted, revision); await refreshEntries();
          notify('Eintrag wiederhergestellt.', 'success');
        }});
      } catch (e) {setError(germanError(e));}
    },
  };
}
