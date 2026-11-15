import {useRef, useState} from 'react';
import {BookmarkPlus, X} from 'lucide-react';
import {createTemplate} from '../planningDb';
import {germanError} from '../german';
import {useToast} from './ToastProvider';

export default function TemplateSaveForm({date, meal, onClose}: {date: string; meal: string; onClose: () => void}) {
  const [name, setName] = useState(`Mein ${meal}`);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const notify = useToast();
  return <form className="meal-copy editor" onSubmit={async event => {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true);
    try {await createTemplate(date, meal, name); notify('Mahlzeiten-Vorlage gespeichert. Du findest sie unter „Planen → Vorlagen“.', 'success'); onClose();}
    catch (error) {notify(germanError(error), 'error');}
    finally {saving.current = false; setBusy(false);}
  }}>
    <div className="section-head"><h3>Als Vorlage speichern</h3><button type="button" className="iconbtn" disabled={busy} aria-label="Vorlage abbrechen" onClick={onClose}><X size={17}/></button></div>
    <label>Name der Vorlage<input required value={name} disabled={busy} onChange={event => setName(event.target.value)}/></label>
    <p className="hint">Alle Einträge dieser Mahlzeit werden mit ihren Mengen und Nährwerten gespeichert.</p>
    <button className="primary wide" disabled={busy || !name.trim()}><BookmarkPlus size={17}/>{busy ? 'Wird gespeichert…' : 'Vorlage speichern'}</button>
  </form>;
}
