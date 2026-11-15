import {useEffect, useId, useRef, useState} from 'react';
import {fmt} from '../nutrition';
import {weightDate, weightsInRange, type WeightRange, type WeightRecord} from '../weight';
import {revealOpeningDetails} from '../hooks/useScrollReveal';

export default function WeightChart({records, date, showRanges = true}: {records: WeightRecord[]; date: string; showRanges?: boolean}) {
  const id = useId();
  const [range, setRange] = useState<WeightRange>('30');
  const [activeDate, setActiveDate] = useState('');
  const chart = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, []);
  const visible = weightsInRange(records, date, range);
  const active = visible.find(record => record.date === activeDate) ?? visible.at(-1);
  const height = width < 480 ? 240 : 280;
  const left = 50, right = 16, top = 20, bottom = 38;
  const values = visible.map(record => record.kg);
  const min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max(0.5, (max - min) * 0.2);
  const low = Math.max(0, min - padding), high = max + padding;
  const start = visible.length ? Date.parse(visible[0].date) : 0;
  const end = visible.length ? Date.parse(visible[visible.length - 1].date) : 0;
  const points = visible.map(record => ({
    ...record,
    x: end === start ? (left + width - right) / 2
      : left + (Date.parse(record.date) - start) / (end - start) * (width - left - right),
    y: top + (high - record.kg) / (high - low) * (height - top - bottom),
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  const area = points.length > 1 ? `${line} L${points[points.length - 1].x},${height - bottom} L${points[0].x},${height - bottom} Z` : '';

  return <div className="weight-chart" ref={chart}>
    <div className="weight-chart__heading"><h3>Gewichtsverlauf</h3>
      {showRanges && <div className="weight-ranges" role="group" aria-label="Zeitraum des Gewichtsverlaufs">
        {([['30', '30 Tage'], ['90', '90 Tage'], ['all', 'Gesamt']] as const).map(([value, label]) =>
          <button type="button" key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>)}
      </div>}
    </div>
    {visible.length === 0 ? <div className="weight-chart__empty">Noch keine Gewichtswerte in diesem Zeitraum.<br/>Trage dein Gewicht ein, um deinen Verlauf zu sehen.</div> : <>
      <div className="weight-chart__detail" aria-live="polite">{active && <><strong>{fmt(active.kg, 3)} kg</strong><span>{weightDate(active.date)}</span></>}</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>Gewichtsverlauf in Kilogramm</title>
        <desc id={`${id}-description`}>Messpunkte nach Datum. Einzelne Punkte mit der Maus, per Berührung oder mit der Tabulatortaste auswählen. Die Gewichtsskala passt sich den Messwerten an.</desc>
        <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6b9c7d" stopOpacity="0.28"/><stop offset="100%" stopColor="#6b9c7d" stopOpacity="0.02"/></linearGradient></defs>
        {Array.from({length: 5}, (_, index) => {
          const y = top + index / 4 * (height - top - bottom);
          return <g key={index}><line x1={left} x2={width - right} y1={y} y2={y} className="weight-chart__grid"/>
            <text x={left - 10} y={y + 4} textAnchor="end">{fmt(high - index / 4 * (high - low), 2)}</text></g>;
        })}
        <text x={left - 10} y={10} textAnchor="end">kg</text>
        {area && <path d={area} fill={`url(#${id}-fill)`}/>}
        <path d={line} fill="none" stroke="#315c46" strokeWidth="3" strokeLinejoin="round"/>
        {points.map(point => <g key={point.date}>
          <circle cx={point.x} cy={point.y} r={active?.date === point.date ? 6 : 4} fill="#315c46" stroke="white" strokeWidth="2"/>
          <circle className="weight-chart__point" cx={point.x} cy={point.y} r="12" fill="transparent" tabIndex={0}
            aria-label={`${weightDate(point.date)}: ${fmt(point.kg, 3)} Kilogramm`}
            onPointerEnter={() => setActiveDate(point.date)} onFocus={() => setActiveDate(point.date)} onClick={() => setActiveDate(point.date)}>
            <title>{`${weightDate(point.date)}: ${fmt(point.kg, 3)} kg`}</title>
          </circle>
        </g>)}
        {points.length === 1 ? <text x={points[0].x} y={height - 8} textAnchor="middle">{weightDate(points[0].date)}</text> : <>
          <text x={left} y={height - 8}>{weightDate(visible[0].date)}</text>
          <text x={width - right} y={height - 8} textAnchor="end">{weightDate(visible[visible.length - 1].date)}</text>
        </>}
      </svg>
      <p className="hint">{visible.length === 1 ? 'Mit einer weiteren Messung wird dein Verlauf sichtbar. ' : ''}Die Skala passt sich deinen Messwerten an. Tage ohne Messung werden nicht als 0 kg dargestellt.</p>
      <details className="weight-chart__table"><summary onClick={revealOpeningDetails}>Messwerte anzeigen ({visible.length})</summary>
        <table><caption>Gewichtsmessungen im gewählten Zeitraum</caption><thead><tr><th scope="col">Datum</th><th scope="col">Gewicht</th></tr></thead>
          <tbody>{[...visible].reverse().map(record => <tr key={record.date}><td>{weightDate(record.date)}</td><td>{fmt(record.kg, 3)} kg</td></tr>)}</tbody></table>
      </details>
    </>}
  </div>;
}
