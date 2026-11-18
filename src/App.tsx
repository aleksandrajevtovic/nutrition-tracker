import {useDraftState} from './components/DraftRecoveryProvider';

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
import {duplicateRecipeFood, emptyRecipeFood} from './recipes';
import PlanningPage from './components/PlanningPage';
import {useNavigationGuard} from './components/UnsavedChangesProvider';
import ProductImport from './components/ProductImport';

type Tab = 'today' | 'week' | 'foods' | 'planning' | 'settings';

export default function App() {
  const [tab, setTab] = useDraftState<Tab>('App:tab', 'today');
  const [date, setDate] = useDraftState('App:date', today);
  const [editing, setEditing] = useDraftState<Food | null>('App:editing', null);
  const [recipeCopySource, setRecipeCopySource] = useDraftState<string>('App:recipeCopySource');
  const editFood = (food: Food) => {setRecipeCopySource(undefined); setEditing(food);};
  const [importing, setImporting] = useDraftState('App:importing', false);
  const data = useNutritionData(date);
  const confirmNavigation = useNavigationGuard();
  const navigate = (next: Tab) => {if (next !== tab && confirmNavigation()) setTab(next);};
  const openDay = (value: string) => {if (confirmNavigation()) {setDate(value); setTab('today');}};

  if (!data.ready) return <main className="app"><p>Wird geladen… {data.error}</p></main>;
  return <div className="app">
    <header><div className="brand"><span className="logo">◒</span><div><strong>Ernährungstagebuch</strong><small>Deine Ernährung im Überblick</small></div></div></header>
    <main>
      {tab === 'today' && <DiaryPage date={date} foods={data.foods} entries={data.entries}
        onDateChange={setDate} onSave={data.persistEntry} onDelete={data.deleteEntry} onCopy={data.copyMeal} onQuantityChange={data.persistQuantity} onSaveFood={data.persistFood} onTransfer={data.transferEntry}/>}
      {tab === 'foods' && <FoodsPage foods={data.foods} onEdit={editFood} onDelete={data.deleteFood} onFavorite={data.toggleFavorite} onNewRecipe={() => editFood(emptyRecipeFood())} onScan={() => setImporting(true)}
        onDuplicateRecipe={food => {setEditing(duplicateRecipeFood(food)); setRecipeCopySource(food.name);}}/>}
      {tab === 'week' && <WeeklyPage date={date} onOpenDay={openDay}/>}
      {tab === 'planning' && <PlanningPage foods={data.foods} date={date} onOpenDay={openDay}/>}
      {tab === 'settings' && <BackupPage onRestored={data.reload}/>}
    </main>
    <nav>
      <button className={tab === 'today' ? 'active' : ''} onClick={() => navigate('today')}><CalendarDays size={20}/>Tagebuch</button>
      <button className={tab === 'week' ? 'active' : ''} aria-label="Wochenübersicht" onClick={() => navigate('week')}><BarChart3 size={20}/>Woche</button>
      <button className={tab === 'foods' ? 'active' : ''} onClick={() => navigate('foods')}><Package size={20}/>Produkte</button>
      <button className={tab === 'planning' ? 'active' : ''} onClick={() => navigate('planning')}><CalendarPlus size={20}/>Planen</button>
      <button className={tab === 'settings' ? 'active' : ''} aria-label="Datensicherung" onClick={() => navigate('settings')}><Settings size={20}/><span className="nav-label-short">Sicherung</span><span className="nav-label-full">Datensicherung</span></button>
    </nav>
    {importing && <ProductImport foods={data.foods} onSave={data.persistFood} onClose={() => setImporting(false)}/>}
    {editing && (editing.recipe ? <RecipeEditor key={editing.id} food={editing} foods={data.foods} existing={data.foods.some(f => f.id === editing.id)} copySource={recipeCopySource} onSaveFood={data.persistFood}
      onClose={() => setEditing(null)} onSave={async food => {await data.persistFood(food); setEditing(null);}}/>
      : <FoodEditor key={editing.id} food={editing} existing={data.foods.some(f => f.id === editing.id)}
        onClose={() => setEditing(null)} onSave={async food => {await data.persistFood(food); setEditing(null);}}/>)}
  </div>;
}
