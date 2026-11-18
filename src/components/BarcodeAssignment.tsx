import {useDraftState} from './DraftRecoveryProvider';
import {useRef, useState} from 'react';
import {Check, X} from 'lucide-react';
import {assignFoodBarcode, getDataRevision, type Food} from '../db';
import {useImportDialog} from '../hooks/useImportDialog';
import {useDraftGuard} from './UnsavedChangesProvider';
import {useToast} from './ToastProvider';
import {germanError} from '../german';
import {fmt} from '../nutrition';
import FoodPicker from './FoodPicker';

export default function BarcodeAssignment({barcode, foods, onLinked, onClose}: {barcode: string; foods: Food[]; onLinked: (food: Food) => void; onClose: () => void}) {
  const [selected, setSelected] = useDraftState<Food>('BarcodeAssignment:selected'), [busy, setBusy] = useState(false);
  const revision = useRef(getDataRevision()), running = useRef(false);
  const guard = useDraftGuard('Barcode-Zuordnung', selected?.id, busy, 'barcode-assignment');
  const notify = useToast();
  const close = () => {if (guard.confirmLeave()) onClose();};
  const dialog = useImportDialog(close);
  const candidates = foods.filter(food => !food.barcode);
  return <div ref={dialog} tabIndex={-1} className="overlay" role="dialog" aria-modal="true" aria-labelledby="barcode-assignment-title">
    <form className="modal editor barcode-assignment" onSubmit={async event => {
      event.preventDefault();event.stopPropagation();if (!selected || running.current) return;
      running.current = true;setBusy(true);
      try {const linked = await assignFoodBarcode(selected.id, barcode, revision.current);guard.markSaved();notify('Barcode dem vorhandenen Lebensmittel zugeordnet.', 'success');onLinked(linked);}
      catch (error) {notify(germanError(error), 'error');}
      finally {running.current = false;setBusy(false);}
    }}>
      <div className="section-head"><h2 id="barcode-assignment-title">Barcode zuordnen</h2><button type="button" className="iconbtn" aria-label="Barcode-Zuordnung abbrechen" disabled={busy} onClick={close}><X size={18}/></button></div>
      <p className="hint">Barcode: <strong>{barcode}</strong></p>
      <p className="hint">Wähle ein gespeichertes Lebensmittel ohne Barcode. Es wird nur der Barcode ergänzt. Deine eigenen Nährwerte, Portionen und Korrekturen bleiben erhalten; Angaben aus dem Import werden nicht übernommen.</p>
      {candidates.length ? <FoodPicker foods={candidates} selected={selected} disabled={busy} onChange={setSelected}/> : <p className="hint" role="status">Keine Lebensmittel ohne Barcode vorhanden.</p>}
      {selected && <p className="hint">{selected.name} · {fmt(selected.kcal)} kcal / 100 g · {selected.portionName} = {fmt(selected.portionGrams,3)} g</p>}
      <button type="submit" className="primary wide" disabled={busy || !selected}><Check size={17}/>{busy ? 'Wird zugeordnet…' : 'Barcode zuordnen'}</button>
    </form>
  </div>;
}
