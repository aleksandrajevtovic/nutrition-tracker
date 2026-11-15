import type {Food} from '../db';
import {portionOptions, selectPortion} from '../foodValues';
import {fmt} from '../nutrition';

export default function PortionPicker({food, onChange, disabled, label = 'Portionsgröße'}: {
  food: Food; onChange: (food: Food) => void; disabled?: boolean; label?: string;
}) {
  const options = portionOptions(food);
  if (options.length < 2) return null;
  return <label>{label}<select aria-label={label} value={food.portionName} disabled={disabled} onChange={event => onChange(selectPortion(food, event.target.value))}>
    {options.map(portion => <option key={portion.name} value={portion.name}>{portion.name} ({fmt(portion.grams, 3)} g)</option>)}
  </select></label>;
}
