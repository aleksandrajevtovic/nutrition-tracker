import {useState} from 'react';
import {CookingPot, Plus, Star} from 'lucide-react';
import type {Food} from '../db';
import {emptyFood} from '../nutrition';
import {filterFoods} from '../foods';
import FoodCard from './FoodCard';

export default function FoodsPage({foods, onEdit, onDelete, onFavorite, onNewRecipe}: {
  foods: Food[]; onEdit: (food: Food) => void; onDelete: (food: Food) => void; onFavorite: (id: string) => Promise<void>;
  onNewRecipe: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'recipes'>('all');
  const filtered = filterFoods(foods, search, filter === 'favorites').filter(food => filter !== 'recipes' || food.recipe);
  return <>
    <div className="heading"><div><span className="eyebrow">MEINE DATENBANK</span><h1>Lebensmittel</h1></div>
      <div className="food-page__actions"><button className="secondary" onClick={onNewRecipe}><CookingPot size={17}/>Neues Rezept</button>
        <button className="primary" onClick={() => onEdit(emptyFood())}><Plus size={17}/> Neu</button></div></div>
    <input className="search" aria-label="Lebensmittel suchen" placeholder="Lebensmittel suchen…" value={search} onChange={e => setSearch(e.target.value)}/>
    <div className="food-filters" role="group" aria-label="Lebensmittel filtern">
      <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Alle Lebensmittel</button>
      <button type="button" aria-pressed={filter === 'favorites'} onClick={() => setFilter('favorites')}><Star size={16}/>Favoriten ({foods.filter(food => food.favorite).length})</button>
      <button type="button" aria-pressed={filter === 'recipes'} onClick={() => setFilter('recipes')}><CookingPot size={16}/>Rezepte ({foods.filter(food => food.recipe).length})</button>
    </div>
    <p className="hint">Die Übersicht zeigt Nährwerte pro 100 g. Unter „Bearbeiten“ kannst du Werte auch pro Portion, pro 100 ml oder für eine eigene Menge eingeben und weitere Portionsgrößen festlegen.</p>
    {filtered.length ? <div className="food-list">{filtered.map(food => <FoodCard key={food.id} food={food} onEdit={onEdit} onDelete={onDelete} onFavorite={onFavorite}/>)}</div>
      : <div className="empty"><Star size={26}/><strong>{filter === 'favorites' ? 'Keine passenden Favoriten' : filter === 'recipes' ? 'Noch keine passenden Rezepte' : 'Keine Lebensmittel gefunden'}</strong><p>{filter === 'favorites' ? 'Markiere Lebensmittel mit dem Stern oder passe deine Suche an.' : filter === 'recipes' ? 'Lege über „Neues Rezept“ dein erstes Gericht an oder passe deine Suche an.' : 'Passe deine Suche an oder lege ein neues Lebensmittel an.'}</p></div>}
  </>;
}
