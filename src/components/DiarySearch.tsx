import {useMemo, useState} from 'react';
import {Search, X} from 'lucide-react';
import type {Entry} from '../db';
import {searchDiary, validDiaryRange} from '../diaryHistory';
import {useDiaryHistory} from '../hooks/useDiaryHistory';
import {stats} from '../nutrition';
import {entryQuantity} from '../quantityLabels';
import {weightDate} from '../weight';
import {useScrollReveal} from '../hooks/useScrollReveal';
import './DiarySearch.css';

export default function DiarySearch({onOpen, onClose}: {onOpen: (entry: Entry) => void; onClose: () => void}) {
  const history = useDiaryHistory();
  const [text, setText] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(30);
  const sectionRef = useScrollReveal<HTMLElement>(true);
  const valid = validDiaryRange({from, to});
  const results = useMemo(() => searchDiary(history.entries, {text, from, to}), [history.entries, text, from, to]);
  return <section ref={sectionRef} className="panel diary-search" aria-labelledby="diary-search-title">
    <div className="section-head"><h3 id="diary-search-title"><Search size={17} aria-hidden="true"/>Tagebuch durchsuchen</h3>
      <button type="button" className="iconbtn" aria-label="Tagebuchsuche schließen" onClick={onClose}><X size={18}/></button></div>
    <label>Suchbegriff<input type="search" autoFocus value={text} placeholder="Lebensmittel, Marke, Mahlzeit oder Notiz…" onChange={event => {setText(event.target.value); setLimit(30);}}/></label>
    <div className="diary-search__range"><label>Suche ab Datum (optional)<input type="date" value={from} onChange={event => {setFrom(event.target.value); setLimit(30);}}/></label>
      <label>Suche bis Datum (optional)<input type="date" value={to} onChange={event => {setTo(event.target.value); setLimit(30);}}/></label></div>
    <p className="hint">Durchsucht alle gespeicherten Tagebucheinträge, auch Einträge zu inzwischen gelöschten Produkten. Ohne Suchbegriff siehst du die neuesten Einträge.</p>
    {!valid ? <p className="hint" role="alert">Bitte einen gültigen Zeitraum wählen. Das Enddatum muss am oder nach dem Startdatum liegen.</p>
      : history.loading ? <p className="hint" role="status">Einträge werden geladen…</p>
      : history.failed ? <p className="hint">Das Tagebuch konnte nicht durchsucht werden. <button type="button" className="secondary" onClick={history.reload}>Erneut versuchen</button></p>
      : <><p className="hint" role="status">{results.length ? `${results.length} ${results.length === 1 ? 'Eintrag gefunden' : 'Einträge gefunden'}` : 'Keine passenden Einträge gefunden.'}</p>
        <div className="diary-search__results">{results.slice(0, limit).map(entry => <article className="diary-search__result" key={entry.id}>
          <strong>{entry.foodSnapshot.name}</strong><small>{weightDate(entry.date)} · {entry.meal}</small>
          <small>{entryQuantity(entry)} · {Math.round(stats(entry.foodSnapshot, entry.grams).kcal)} kcal{entry.foodSnapshot.brand ? ` · ${entry.foodSnapshot.brand}` : ''}</small>
          {entry.note?.trim() && <p>{entry.note}</p>}
          <button type="button" className="secondary" aria-label={`${entry.foodSnapshot.name} am ${weightDate(entry.date)} bearbeiten`} onClick={() => onOpen(entry)}>Eintrag bearbeiten</button>
        </article>)}</div>
        {results.length > limit && <button type="button" className="secondary wide" onClick={() => setLimit(value => value + 30)}>Weitere Treffer anzeigen ({results.length - limit})</button>}
      </>}
  </section>;
}
