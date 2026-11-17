import {Clock} from 'lucide-react';
import type {Food} from '../db';
import {recentFoods, scaleRecentAmount, type RecentFood} from '../diaryHistory';
import type {useDiaryHistory} from '../hooks/useDiaryHistory';
import {fmt, stats, unitLabels} from '../nutrition';
import {portionQuantity} from '../quantityLabels';
import {revealOpeningDetails} from '../hooks/useScrollReveal';
import './RecentFoods.css';

const factors = [{value: .5, label: '½', description: 'halber Menge'}, {value: 1, label: '1×', description: 'einfacher Menge'}, {value: 2, label: '2×', description: 'doppelter Menge'}];

export default function RecentFoods({foods, busy, onSelect, onAdd, history}: {
  foods: Food[]; busy: boolean; onSelect: (recent: RecentFood) => void; onAdd: (recent: RecentFood) => void;
  history: ReturnType<typeof useDiaryHistory>;
}) {
  const recent = recentFoods(history.entries, foods);
  return <details className="recent-foods"><summary onClick={revealOpeningDetails}><Clock size={16} aria-hidden="true"/>Zuletzt verwendet</summary>
    {history.loading ? <p className="hint" role="status">Letzte Lebensmittel werden geladen…</p> : history.failed ? <p className="hint">Letzte Lebensmittel konnten nicht geladen werden. <button type="button" onClick={history.reload}>Erneut versuchen</button></p>
      : !recent.length ? <p className="hint">Hier erscheinen deine zuletzt eingetragenen Lebensmittel.</p>
      : <><p className="hint">Name antippen, um die Menge anzupassen. ½, 1× und 2× tragen die halbe, einfache oder doppelte letzte Menge sofort zur oben gewählten Mahlzeit ein. Verwendet aktuelle Produktwerte.</p>
        <div className="recent-foods__list">{recent.map(item => <div className="recent-foods__item" key={item.food.id}>
          <button type="button" className="recent-foods__select" disabled={busy} onClick={() => onSelect(item)} aria-label={`${item.food.name} mit letzter Menge auswählen`}>
            <strong>{item.food.name}</strong><span>{item.unit === 'portion' ? portionQuantity(item.amount,item.food.portionName,item.grams) : `${fmt(item.amount,3)} ${unitLabels[item.unit]}`} · {Math.round(stats(item.food, item.grams).kcal)} kcal</span>
          </button>
          <div className="recent-foods__amount-actions">{factors.map(factor => {
            const scaled = scaleRecentAmount(item, factor.value);
            const quantity = scaled ? scaled.unit === 'portion' ? portionQuantity(scaled.amount, scaled.food.portionName, scaled.grams) : `${fmt(scaled.amount,3)} ${unitLabels[scaled.unit]}` : '';
            return <button key={factor.value} type="button" disabled={busy || !scaled} aria-label={factor.value === 1 ? `${item.food.name} erneut hinzufügen` : `${item.food.name} mit ${factor.description} hinzufügen`}
              title={`${quantity} direkt hinzufügen`} onClick={() => {if (scaled) onAdd(scaled);}}>{factor.label}</button>;
          })}</div>
        </div>)}</div></>}
  </details>;
}
