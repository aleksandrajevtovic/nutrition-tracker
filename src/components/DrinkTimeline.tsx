import {Pencil, Trash2} from 'lucide-react';
import {drinkTimeline, type Drink} from '../hydration';
import {fmt} from '../nutrition';

export default function DrinkTimeline({drinks, busy, onEdit, onDelete}: {
  drinks: Drink[]; busy: boolean; onEdit: (drink: Drink) => void; onDelete: (drink: Drink) => void;
}) {
  const timeline = drinkTimeline(drinks);
  const total = timeline.at(-1)?.totalMl ?? 0;
  return <section className="drink-timeline" aria-label="Trinkverlauf des Tages"><h3>Tagesverlauf</h3>
    {!timeline.length ? <p className="hint">Für diesen Tag ist noch kein Getränk eingetragen.</p>
      : <ol>{timeline.map(drink => <li key={drink.id}>
        <div className="drink-timeline__caption"><time>{drink.time}</time><strong>{drink.name}</strong><b>{fmt(drink.ml, 3)} ml</b></div>
        <div className="drink-timeline__bar" aria-hidden="true"><span style={{width: `${drink.totalMl / total * 100}%`}}/></div>
        <div className="drink-timeline__footer"><small>Bis dahin: {fmt(drink.totalMl / 1000, 3)} l</small><div className="actions">
          <button type="button" title="Getränk bearbeiten" aria-label={`${drink.name} um ${drink.time} bearbeiten`} disabled={busy} onClick={() => onEdit(drink)}><Pencil size={16}/></button>
          <button type="button" title="Getränk löschen" aria-label={`${drink.name} um ${drink.time} löschen`} disabled={busy} onClick={() => onDelete(drink)}><Trash2 size={16}/></button>
        </div></div>
      </li>)}</ol>}
  </section>;
}
