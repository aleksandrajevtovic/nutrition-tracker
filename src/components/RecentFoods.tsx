import {Clock, Plus} from 'lucide-react';
import type {Food} from '../db';
import {recentFoods, type RecentFood} from '../diaryHistory';
import {useDiaryHistory} from '../hooks/useDiaryHistory';
import {fmt, stats, unitLabels} from '../nutrition';
import {portionQuantity} from '../quantityLabels';
import {revealOpeningDetails} from '../hooks/useScrollReveal';
import './RecentFoods.css';

export default function RecentFoods({foods, busy, onSelect, onAdd}: {
  foods: Food[]; busy: boolean; onSelect: (recent: RecentFood) => void; onAdd: (recent: RecentFood) => void;
}) {
  const history = useDiaryHistory();
  const recent = recentFoods(history.entries, foods);
  return <details className="recent-foods"><summary onClick={revealOpeningDetails}><Clock size={16} aria-hidden="true"/>Zuletzt verwendet</summary>
    {history.loading ? <p className="hint" role="status">Letzte Lebensmittel werden geladen…</p> : history.failed ? <p className="hint">Letzte Lebensmittel konnten nicht geladen werden. <button type="button" onClick={history.reload}>Erneut versuchen</button></p>
      : !recent.length ? <p className="hint">Hier erscheinen deine zuletzt eingetragenen Lebensmittel.</p>
      : <><p className="hint">Auswählen, um die Menge anzupassen. Mit + direkt zur oben gewählten Mahlzeit hinzufügen. Verwendet aktuelle Produktwerte.</p>
        <div className="recent-foods__list">{recent.map(item => <div className="recent-foods__item" key={item.food.id}>
          <button type="button" className="recent-foods__select" disabled={busy} onClick={() => onSelect(item)} aria-label={`${item.food.name} mit letzter Menge auswählen`}>
            <strong>{item.food.name}</strong><span>{item.unit === 'portion' ? portionQuantity(item.amount,item.food.portionName,item.grams) : `${fmt(item.amount,3)} ${unitLabels[item.unit]}`} · {Math.round(stats(item.food, item.grams).kcal)} kcal</span>
          </button>
          <button type="button" className="iconbtn" disabled={busy} onClick={() => onAdd(item)} aria-label={`${item.food.name} erneut hinzufügen`} title="Direkt hinzufügen"><Plus size={18}/></button>
        </div>)}</div></>}
  </details>;
}
