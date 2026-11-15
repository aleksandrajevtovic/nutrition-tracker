import {Clock3} from 'lucide-react';
import {formatExportTime} from '../backup';
import './BackupStatus.css';

export default function BackupStatus({lastExport, loading, failed, onRetry}: {
  lastExport: string | null; loading: boolean; failed: boolean; onRetry: () => void;
}) {
  return <section className="panel backup-status" aria-labelledby="backup-status-title">
    <Clock3 size={22} aria-hidden="true"/>
    <div className="backup-status__content"><h2 id="backup-status-title">Letzter Export</h2>
      <div className="backup-status__value" role="status" aria-live="polite">
        {loading ? 'Exportstatus wird geladen…' : failed ? 'Exportstatus konnte nicht geladen werden.' : lastExport
          ? <time dateTime={lastExport}>{formatExportTime(lastExport)} Uhr</time>
          : 'Noch kein Export erfasst'}
      </div>
      <p className="hint">Erfasst den zuletzt gestarteten Sicherungsdownload auf diesem Gerät und in diesem Browser.</p>
      {failed && <button type="button" className="secondary" onClick={onRetry}>Erneut versuchen</button>}
    </div>
  </section>;
}
