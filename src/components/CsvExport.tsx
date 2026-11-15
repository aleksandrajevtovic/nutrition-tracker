import {useRef, useState} from 'react';
import {FileSpreadsheet} from 'lucide-react';
import {getBackup} from '../db';
import {dailyCsv} from '../csv';
import {today} from '../nutrition';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import './CsvExport.css';

export default function CsvExport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const exporting = useRef(false);
  const notify = useToast();

  return <section className="panel settings csv-export" aria-labelledby="csv-export-title"><h3 id="csv-export-title">Tageswerte als CSV</h3>
    <p>Eine Zeile pro Tag mit Kalorien, Protein, Kohlenhydraten, Fett, Ballaststoffen, Zucker und Gewicht – für deine eigene Auswertung.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (exporting.current) return;
      exporting.current = true; setBusy(true);
      try {
        const data = await getBackup();
        const {csv, rowCount} = dailyCsv(data.entries, data.weights, {from, to});
        if (!rowCount) {notify('Für diesen Zeitraum sind noch keine Tageswerte vorhanden.', 'error'); return;}
        const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
        try {
          const link = document.createElement('a');
          link.href = url; link.download = `ernaehrung-tageswerte-${today()}.csv`; link.click();
        } finally {setTimeout(() => URL.revokeObjectURL(url), 1000);}
        notify(`CSV-Auswertung mit ${rowCount} ${rowCount === 1 ? 'Tag' : 'Tagen'} erstellt.`, 'success');
      } catch (error) {notify(germanError(error), 'error');}
      finally {exporting.current = false; setBusy(false);}
    }}>
      <div className="csv-export__range"><label>Von (optional)<input type="date" value={from} disabled={busy} onChange={event => setFrom(event.target.value)}/></label>
        <label>Bis (optional)<input type="date" value={to} disabled={busy} onChange={event => setTo(event.target.value)}/></label></div>
      <button className="secondary wide" disabled={busy}><FileSpreadsheet size={17}/>{busy ? 'CSV wird erstellt…' : 'CSV-Tageswerte herunterladen'}</button>
    </form>
    <p className="hint">Leere Datumsfelder exportieren alle vorhandenen Tage. Fehlende Ernährungs- oder Gewichtsdaten bleiben leer. Geplante Mahlzeiten zählen erst nach ihrer Übernahme ins Tagebuch mit. Zahlen verwenden das deutsche Dezimalkomma.</p>
    <p className="hint">Für die Wiederherstellung weiterhin das JSON-Backup verwenden. Der CSV-Export verändert den Zeitpunkt der letzten Datensicherung nicht.</p>
  </section>;
}
