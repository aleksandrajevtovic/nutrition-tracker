import {germanError} from '../german';
import {useRef, useState} from 'react';
import {Download, Upload} from 'lucide-react';
import {getBackup, restoreBackup} from '../db';
import {today} from '../nutrition';
import {useToast} from './ToastProvider';
import {useBackupStatus} from '../hooks/useBackupStatus';
import BackupStatus from './BackupStatus';
import CsvExport from './CsvExport';

export default function BackupPage({onRestored}: {
  onRestored: () => Promise<void>;
}) {
  const notify = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const status = useBackupStatus();

  async function download() {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    try {
      const data = await getBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
      try {
        const link = document.createElement('a');
        link.href = url; link.download = `ernaehrung-datensicherung-${today()}.json`; link.click();
      } finally {setTimeout(() => URL.revokeObjectURL(url), 1000);}
      try {await status.recordExport();}
      catch (error) {
        console.error(error);
        notify('Die Datensicherung wurde erstellt, der Exportzeitpunkt konnte aber nicht gespeichert werden.', 'error');
        return;
      }
      notify('Datensicherung erfolgreich erstellt.', 'success');
    } catch (e) { notify(germanError(e), 'error'); }
    finally {operation.current = false; setBusy(false);}
  }

  async function upload(file: File) {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      if (!confirm('Datensicherung importieren? Produkte, Rezepte und Tagebucheinträge werden ersetzt. Enthaltene Gewichtsdaten, Trinkdaten, Tagesziele, Tagesnotizen, Markierungen vollständiger Tage, Vorlagen, Wochenpläne und Einkaufslisten ersetzen die bisherigen Werte. Ältere Sicherungen ohne diese Bereiche lassen sie unverändert. Bitte vorher eine Datensicherung exportieren.')) return;
      await restoreBackup(parsed); await onRestored(); notify('Datensicherung erfolgreich importiert.', 'success');
    } catch (e) { notify(`Import fehlgeschlagen: ${germanError(e)}`, 'error'); }
    finally {operation.current = false; setBusy(false);}
  }

  return <>
    <div className="heading"><div><span className="eyebrow">DATENSICHERUNG</span><h1>Datensicherung & Wiederherstellung</h1></div></div>
    <BackupStatus lastExport={status.lastExport} loading={status.loading} failed={status.failed} onRetry={status.reload}/>
    <section className="panel settings"><h3>Deine Daten bleiben lokal</h3>
      <p>Produkte, Rezepte, Mahlzeiten, Gewichtsmessungen, Trinkdaten, Tagesziele, Tagesnotizen, Vorlagen, Wochenpläne und Einkaufslisten werden auf diesem Gerät und in diesem Browser gespeichert. Es gibt keine Synchronisierung zwischen Geräten.</p>
      <button className="primary wide" disabled={busy} onClick={download}><Download size={17}/> JSON-Datensicherung herunterladen</button>
      <button className="secondary wide" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={17}/> JSON-Datensicherung importieren</button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => {
        const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = '';
      }}/>
      <p className="hint">Die Datensicherung enthält auch Getränke mit Menge und Uhrzeit, Tagesnotizen, Markierungen vollständiger Tage, Rezepte samt Zutaten, Vorlagen, Wochenpläne und Einkaufslisten mit Häkchen. Beim Import werden enthaltene Bereiche ersetzt. Ältere Sicherungen ohne diese Bereiche lassen sie unverändert. Exportiere regelmäßig eine Datensicherung, insbesondere vor dem Löschen von Browserdaten oder einem Gerätewechsel.</p>
    </section>
    <CsvExport/>
    <section className="panel settings"><h3>App installieren</h3>
      <p>Die App läuft als statische Website. Über „Zum Startbildschirm hinzufügen“ kannst du sie auf deinem Handy installieren. Nutzung ohne Internetverbindung ist nach dem ersten erfolgreichen Laden möglich.</p>
    </section>
  </>;
}
