import {useRef, useState} from 'react';
import {FileSpreadsheet} from 'lucide-react';
import {getBackup} from '../db';
import {dailyCsv, weeklyCsv} from '../csv';
import {today} from '../nutrition';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import './CsvExport.css';

export default function CsvExport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'days' | 'weeks'>('days');
  const exporting = useRef(false);
  const notify = useToast();

  return <section className="panel settings csv-export" aria-labelledby="csv-export-title"><h3 id="csv-export-title">Tages- und Wochenwerte als CSV</h3>
    <p>Tageswerte mit Kalorien, Eiweiß, Kohlenhydraten, Fett, Ballaststoffen, Zucker, Gewicht und Trinkmenge. Wochenwerte enthalten Durchschnittswerte, erfasste Tage und die gesamte Trinkmenge.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (exporting.current) return;
      exporting.current = true; setBusy(true);
      try {
        const data = await getBackup();
        const {csv, rowCount} = (mode === 'days' ? dailyCsv : weeklyCsv)(data.entries, data.weights, {from, to}, data.drinks);
        if (!rowCount) {notify('Für diesen Zeitraum sind noch keine Tageswerte vorhanden.', 'error'); return;}
        const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
        try {
          const link = document.createElement('a');
          link.href = url; link.download = `ernaehrung-${mode === 'days' ? 'tageswerte' : 'wochenwerte'}-${today()}.csv`; link.click();
        } finally {setTimeout(() => URL.revokeObjectURL(url), 1000);}
        const unit = mode === 'days' ? rowCount === 1 ? 'Tag' : 'Tagen' : rowCount === 1 ? 'Woche' : 'Wochen';
        notify(`CSV-Auswertung mit ${rowCount} ${unit} erstellt.`, 'success');
      } catch (error) {notify(germanError(error), 'error');}
      finally {exporting.current = false; setBusy(false);}
    }}>
      <label>CSV-Auswertung<select aria-label="CSV-Auswertung" value={mode} disabled={busy} onChange={event => setMode(event.target.value as 'days' | 'weeks')}><option value="days">Tageswerte</option><option value="weeks">Wochenwerte</option></select></label>
      <div className="csv-export__range"><label>Von (optional)<input type="date" value={from} disabled={busy} onChange={event => setFrom(event.target.value)}/></label>
        <label>Bis (optional)<input type="date" value={to} disabled={busy} onChange={event => setTo(event.target.value)}/></label></div>
      <button className="secondary wide" disabled={busy}><FileSpreadsheet size={17}/>{busy ? 'CSV wird erstellt…' : mode === 'days' ? 'CSV-Tageswerte herunterladen' : 'CSV-Wochenwerte herunterladen'}</button>
    </form>
    <p className="hint">Leere Datumsfelder exportieren alle vorhandenen Werte. Fehlende Daten bleiben leer. Durchschnitte verwenden nur Tage mit den jeweiligen Daten. Bei Datumsgrenzen berücksichtigen Wochenwerte nur den gewählten Zeitraum; die ausgewerteten Grenzen stehen in der CSV. Geplante Mahlzeiten zählen erst nach ihrer Übernahme ins Tagebuch mit. Zahlen verwenden das deutsche Dezimalkomma. Trinkmengen stehen in ml.</p>
    <p className="hint">Für die Wiederherstellung weiterhin das JSON-Backup verwenden. Der CSV-Export verändert den Zeitpunkt der letzten Datensicherung nicht.</p>
  </section>;
}
