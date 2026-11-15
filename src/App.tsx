import {useState} from 'react';
import {BarChart3, CalendarDays, CalendarPlus, Package, Settings} from 'lucide-react';
import type {Food} from './db';
import {today} from './nutrition';
import {useNutritionData} from './hooks/useNutritionData';
import DiaryPage from './components/DiaryPage';
import FoodsPage from './components/FoodsPage';
import FoodEditor from './components/FoodEditor';
import BackupPage from './components/BackupPage';
import WeeklyPage from './components/WeeklyPage';
import RecipeEditor from './components/RecipeEditor';
import {emptyRecipeFood} from './recipes';
import PlanningPage from './components/PlanningPage';

type Tab = 'today' | 'week' | 'foods' | 'planning' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<Food | null>(null);
  const data = useNutritionData(date);

  if (!data.ready) return <main className="app"><p>Wird geladen… {data.error}</p></main>;
  return <div className="app">
    <header><div className="brand"><span className="logo">◒</span><div><strong>Ernährungstagebuch</strong><small>Deine Ernährung im Überblick</small></div></div></header>
    <main>
      {tab === 'today' && <DiaryPage date={date} foods={data.foods} entries={data.entries}
        onDateChange={setDate} onSave={data.persistEntry} onDelete={data.deleteEntry} onCopy={data.copyMeal} onQuantityChange={data.persistQuantity}/>}
      {tab === 'foods' && <FoodsPage foods={data.foods} onEdit={setEditing} onDelete={data.deleteFood} onFavorite={data.toggleFavorite} onNewRecipe={() => setEditing(emptyRecipeFood())}/>}
      {tab === 'week' && <WeeklyPage date={date} onOpenDay={value => {setDate(value); setTab('today');}}/>}
      {tab === 'planning' && <PlanningPage foods={data.foods} date={date} onOpenDay={value => {setDate(value); setTab('today');}}/>}
      {tab === 'settings' && <BackupPage onRestored={data.reload}/>}
    </main>
    <nav>
      <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><CalendarDays size={20}/>Tagebuch</button>
      <button className={tab === 'week' ? 'active' : ''} aria-label="Wochenübersicht" onClick={() => setTab('week')}><BarChart3 size={20}/>Woche</button>
      <button className={tab === 'foods' ? 'active' : ''} onClick={() => setTab('foods')}><Package size={20}/>Produkte</button>
      <button className={tab === 'planning' ? 'active' : ''} onClick={() => setTab('planning')}><CalendarPlus size={20}/>Planen</button>
      <button className={tab === 'settings' ? 'active' : ''} aria-label="Datensicherung" onClick={() => setTab('settings')}><Settings size={20}/><span className="nav-label-short">Sicherung</span><span className="nav-label-full">Datensicherung</span></button>
    </nav>
    {editing && (editing.recipe ? <RecipeEditor key={editing.id} food={editing} foods={data.foods} existing={data.foods.some(f => f.id === editing.id)}
      onClose={() => setEditing(null)} onSave={async food => {await data.persistFood(food); setEditing(null);}}/>
      : <FoodEditor key={editing.id} food={editing} existing={data.foods.some(f => f.id === editing.id)}
        onClose={() => setEditing(null)} onSave={async food => {await data.persistFood(food); setEditing(null);}}/>)}
  </div>;
}
