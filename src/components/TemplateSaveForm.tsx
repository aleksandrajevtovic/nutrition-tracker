import {useDraftState} from './DraftRecoveryProvider';
import {useRef, useState} from 'react';
import {BookmarkPlus, X} from 'lucide-react';
import {createTemplate} from '../planningDb';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';
import {useScrollReveal} from '../hooks/useScrollReveal';

export default function TemplateSaveForm({date, meal, onClose}: {date: string; meal: string; onClose: () => void}) {
  const [name, setName] = useDraftState('TemplateSaveForm:name', `Mein ${meal}`);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const notify = useToast();
  const formRef = useScrollReveal<HTMLFormElement>(true);
  const guard = useDraftGuard('Mahlzeiten-Vorlage', name, busy, 'template-save');
  return <form ref={formRef} className="meal-copy editor" onSubmit={async event => {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true);
    try {await createTemplate(date, meal, name); guard.markSaved(); notify('Mahlzeiten-Vorlage gespeichert. Du findest sie unter „Planen → Vorlagen“.', 'success'); onClose();}
    catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }}>
    <div className="section-head"><h3>Als Vorlage speichern</h3><button type="button" className="iconbtn" disabled={busy} aria-label="Vorlage abbrechen" onClick={() => {if (guard.confirmLeave()) onClose();}}><X size={17}/></button></div>
    <label>Name der Vorlage<input required value={name} disabled={busy} onChange={event => setName(event.target.value)}/></label>
    <p className="hint">Alle Einträge dieser Mahlzeit werden mit ihren Mengen und Nährwerten gespeichert.</p>
    <button className="primary wide" disabled={busy || !name.trim()}><BookmarkPlus size={17}/>{busy ? 'Wird gespeichert…' : 'Vorlage speichern'}</button>
  </form>;
}
