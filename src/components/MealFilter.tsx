import {useEffect, useRef} from 'react';
import type {Entry} from '../db';
import {meals} from '../nutrition';
import './MealFilter.css';

export default function MealFilter({entries, selected, onSelect}: {entries: Entry[]; selected: string | null; onSelect: (meal: string | null) => void}) {
  const list = useRef<HTMLDivElement>(null);
  const primary = ['Frühstück', 'Mittagessen', 'Abendessen'];
  const groups = [...new Set([...primary, ...meals, ...entries.map(entry => entry.meal), ...(selected ? [selected] : [])])];
  useEffect(() => {
    const root = list.current;
    const button = root?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!root || !button) return;
    const view = root.getBoundingClientRect(), item = button.getBoundingClientRect();
    if (item.left < view.left || item.right > view.right) root.scrollBy({left: item.left - view.left - 8, behavior: 'instant'});
  }, [selected]);

  return <div className="meal-filter" role="group" aria-label="Mahlzeiten filtern"><div ref={list} className="meal-filter__list">
    {[null, ...groups].map(meal => {
      const count = meal === null ? entries.length : entries.filter(entry => entry.meal === meal).length;
      return <button type="button" key={meal === null ? 'all' : `meal:${meal}`} aria-pressed={selected === meal}
        aria-label={`${meal ?? 'Alle Mahlzeiten'}: ${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`} title={meal ?? 'Alle Mahlzeiten'} onClick={() => onSelect(meal)}>
        <span className="meal-filter__name">{meal ?? 'Alle'}</span><span className="meal-filter__count" aria-hidden="true">{count}</span>
      </button>;
    })}
  </div></div>;
}
