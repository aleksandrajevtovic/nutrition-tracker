import {Plus, Trash2} from 'lucide-react';
import type {Food} from '../db';

export default function FoodPortions({portions, onChange, disabled}: {
  portions: NonNullable<Food['portions']>; onChange: (portions: NonNullable<Food['portions']>) => void; disabled: boolean;
}) {
  return <section className="food-portions" aria-labelledby="food-portions-title">
    <h3 id="food-portions-title">Weitere Portionsgrößen</h3>
    <p className="hint">Zum Beispiel „Klein“ mit 80 g, „Mittel“ mit 150 g und „Groß“ mit 250 g. Alle Größen verwenden die Nährwerte dieses Lebensmittels.</p>
    {portions.map((portion, index) => <div className="food-portions__row" key={index}>
      <label>Name<input aria-label={`Name der Portionsgröße ${index + 1}`} required value={portion.name} disabled={disabled} onChange={event => onChange(portions.map((value, i) => i === index ? {...value, name: event.target.value} : value))}/></label>
      <label>Gewicht in g<input aria-label={`Gramm der Portionsgröße ${index + 1}`} type="number" min="0" step="any" required value={Number.isFinite(portion.grams) ? portion.grams : ''} disabled={disabled} onChange={event => onChange(portions.map((value, i) => i === index ? {...value, grams: event.target.value === '' ? NaN : Number(event.target.value)} : value))}/></label>
      <button className="iconbtn" type="button" disabled={disabled} aria-label={`Portionsgröße ${index + 1} entfernen`} onClick={() => onChange(portions.filter((_, i) => i !== index))}><Trash2 size={17}/></button>
    </div>)}
    <button className="secondary" type="button" disabled={disabled} onClick={() => onChange([...portions, {name: '', grams: 100}])}><Plus size={17}/>Portionsgröße hinzufügen</button>
  </section>;
}
