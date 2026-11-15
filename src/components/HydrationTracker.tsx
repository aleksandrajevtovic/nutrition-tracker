import {useEffect, useId, useRef, useState} from 'react';
import {ChevronDown, Droplets, Plus} from 'lucide-react';
import {getDataRevision, removeDrink, restoreDeletedDrink, saveDrink} from '../db';
import {createDrink, drinkTimeNow, type Drink} from '../hydration';
import {useHydration} from '../hooks/useHydration';
import {fmt} from '../nutrition';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import DrinkForm from './DrinkForm';
import DrinkTimeline from './DrinkTimeline';
import {useNavigationGuard} from './UnsavedChangesProvider';
import './HydrationTracker.css';

export default function HydrationTracker({date}: {date: string}) {
  const data = useHydration(date);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<Drink>();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const notify = useToast();
  const confirmNavigation = useNavigationGuard();
  const total = data.drinks.reduce((sum, drink) => sum + drink.ml, 0);
  const disabled = busy || data.loading || data.failed;
  useEffect(() => {
    if (!editing) return;
    formRef.current?.scrollIntoView({block: 'start', behavior: 'instant'});
    formRef.current?.querySelector<HTMLElement>('h3')?.focus({preventScroll: true});
  }, [editing]);

  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true);
    try {await action();} catch (error) {notify(germanError(error), 'error');}
    finally {running.current = false; setBusy(false);}
  }
  const save = (make: () => Drink, onSaved?: () => void) => void run(async () => {
    const drink = make(); const updating = editing?.id === drink.id;
    await saveDrink(drink); onSaved?.(); if (updating) setEditing(undefined);
    notify(updating ? 'Getränk aktualisiert.' : 'Getränk hinzugefügt.', 'success');
  });

  return <section className="panel hydration" aria-label="Trinkmenge des Tages">
    <div className="hydration__heading"><Droplets size={21} aria-hidden="true"/><div className="hydration__title"><h2>Trinkmenge</h2>
      <p role="status">{data.loading ? 'Wird geladen…' : data.failed ? 'Trinkmenge konnte nicht geladen werden.' : <><strong>{fmt(total / 1000, 3)} l</strong><span> · {data.drinks.length} {data.drinks.length === 1 ? 'Getränk' : 'Getränke'}</span></>}</p></div>
      <button type="button" className="secondary hydration__toggle" aria-controls={contentId} aria-expanded={expanded} aria-label={expanded ? 'Trinkverlauf einklappen' : 'Trinkverlauf aufklappen'} onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Weniger' : 'Mehr'}<ChevronDown size={16} aria-hidden="true"/></button></div>
    {data.failed ? <button type="button" className="secondary" onClick={data.reload}>Trinkdaten erneut laden</button> : <>
      <p className="hydration__quick-label">Wasser schnell hinzufügen</p><div className="hydration__quick">{[150, 250, 500].map(ml => <button type="button" className="secondary" key={ml} disabled={disabled} aria-label={`${ml} ml Wasser hinzufügen`}
        onClick={() => save(() => createDrink(date, 'Wasser', String(ml), 'ml', drinkTimeNow()))}><Plus size={14}/>{ml} ml</button>)}</div>
    </>}
    <div id={contentId} hidden={!expanded}>
      <div ref={formRef}><DrinkForm key={editing?.id ?? 'new'} date={date} drink={editing} busy={disabled} pending={busy} onSave={save} onCancel={() => setEditing(undefined)}/></div>
      <DrinkTimeline drinks={data.drinks} busy={disabled} onEdit={drink => {if (drink.id === editing?.id || confirmNavigation(['drink-form'])) setEditing(drink);}} onDelete={drink => void run(async () => {
        if (!confirm(`${drink.name} um ${drink.time} löschen?`)) return;
        const revision = getDataRevision();
        const removed = await removeDrink(drink.id);
        if (editing?.id === drink.id) setEditing(undefined);
        if (removed) notify('Getränk gelöscht.', 'success', {label: 'Rückgängig', onClick: async () => {await restoreDeletedDrink(removed, revision); notify('Getränk wiederhergestellt.', 'success');}});
      })}/>
    </div>
  </section>;
}
