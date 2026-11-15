import {useEffect, useMemo, useRef, useState} from 'react';
import {BookmarkPlus, BookOpen, CalendarDays, Copy, List, Plus, Search} from 'lucide-react';
import type {Entry, Food} from '../db';
import {meals, stats} from '../nutrition';
import EntryEditor from './EntryEditor';
import WeightTracker from './WeightTracker';
import DailySummary from './DailySummary';
import DailyNotes from './DailyNotes';
import HydrationTracker from './HydrationTracker';
import MealCopyForm, {type CopyMeal} from './MealCopyForm';
import TemplateSaveForm from './TemplateSaveForm';
import DiaryEntry from './DiaryEntry';
import DiarySearch from './DiarySearch';
import {useDiaryView} from '../hooks/useDiaryView';
import type {SaveQuantity} from './QuickQuantity';
import {useNavigationGuard} from './UnsavedChangesProvider';
import './MealCard.css';

export default function DiaryPage({date, foods, entries, onDateChange, onSave, onDelete, onCopy, onQuantityChange}: {
  date: string; foods: Food[]; entries: Entry[]; onDateChange: (date: string) => void;
  onSave: (entry: Entry, conversions: Partial<Food>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopy: CopyMeal;
  onQuantityChange: SaveQuantity;
}) {
  const [editor, setEditor] = useState<{entry: Entry | null} | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const view = useDiaryView();
  const confirmNavigation = useNavigationGuard();
  const openEditor = (entry: Entry | null) => {
    if (editor && editor.entry?.id === entry?.id) {setEditor({entry}); return;}
    if (confirmNavigation(['entry-editor', ...(entry ? [`quantity:${entry.id}`] : [])])) setEditor({entry});
  };
  const toggleCopy = (meal: string) => {if (confirmNavigation(['meal-copy'])) setCopying(copying === meal ? null : meal);};
  const toggleTemplate = (meal: string) => {if (confirmNavigation(['template-save'])) setSavingTemplate(savingTemplate === meal ? null : meal);};
  const editorRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!editor || !editorRef.current) return;
    editorRef.current.scrollIntoView({block: 'start', behavior: 'instant'});
    editorRef.current.querySelector<HTMLElement>('h3')?.focus({preventScroll: true});
  }, [editor]);
  const totals = useMemo(() => entries.reduce((sum, entry) => {
    const values = stats(entry.foodSnapshot, entry.grams);
    for (const key of Object.keys(values) as (keyof typeof values)[]) sum[key] += values[key];
    return sum;
  }, {kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0}), [entries]);
  // Include old/custom meal names so historical entries are never hidden.
  const groups = Array.from(new Set([...meals, ...entries.map(e => e.meal)]));

  return <>
    <div className="heading"><div><span className="eyebrow">TAGESÜBERSICHT</span><h1>Mein Ernährungstagebuch</h1></div>
      <label className="date"><CalendarDays size={17}/><input aria-label="Datum" type="date" required value={date}
        onChange={e => {if (e.target.value && e.target.value !== date && confirmNavigation()) {setEditor(null); setCopying(null); setSavingTemplate(null); onDateChange(e.target.value);}}}/></label></div>
    <DailySummary totals={totals}/>
    <WeightTracker date={date}/>
    <HydrationTracker key={`hydration-${date}`} date={date}/>
    <DailyNotes key={date} date={date}/>
    <div className="section-head"><h2>Mahlzeiten</h2>
      <div className="diary-controls"><button type="button" className="diary-view-toggle" aria-pressed={view.compact} onClick={() => {if (confirmNavigation(['quantity:'])) view.toggle();}}><List size={17} aria-hidden="true"/>Kompakt</button>
      <button ref={searchButtonRef} type="button" className="diary-view-toggle" aria-expanded={searching} onClick={() => setSearching(value => !value)}><Search size={17} aria-hidden="true"/>Tagebuchsuche</button></div>
      <button className="primary" onClick={() => openEditor(null)}><Plus size={17}/> Lebensmittel hinzufügen</button></div>
    {searching && <DiarySearch onClose={() => {setSearching(false); searchButtonRef.current?.focus();}} onOpen={entry => {if (!confirmNavigation(entry.date === date ? ['entry-editor', 'meal-copy', 'template-save', `quantity:${entry.id}`] : undefined)) return; setSearching(false); setCopying(null); setSavingTemplate(null); onDateChange(entry.date); setEditor({entry});}}/>}
    {editor && <div ref={editorRef} className="diary-entry-editor"><EntryEditor key={editor.entry?.id ?? 'new'} foods={foods} date={date} entry={editor.entry}
      onClose={() => setEditor(null)} onSave={async (entry, conversions) => {await onSave(entry, conversions); setEditor(null);}}/></div>}
    <div className={view.compact ? 'diary-meals diary-meals--compact' : 'diary-meals'}>
    {entries.length === 0 ? <div className="empty"><BookOpen size={30}/><strong>Noch keine Einträge</strong><p>Füge dein erstes Lebensmittel für diesen Tag hinzu.</p></div>
      : groups.map(meal => {
        const group = entries.filter(e => e.meal === meal);
        if (!group.length) return null;
        return <section className="meal panel" key={meal}>
          <div className="meal__heading"><h3>{meal}</h3><div className="meal__tools">
            <b className="meal__calories">{Math.round(group.reduce((sum, e) => sum + stats(e.foodSnapshot, e.grams).kcal, 0))} <small>kcal</small></b>
            <button type="button" className="iconbtn" title="Mahlzeit kopieren" aria-label={`${meal} kopieren`} aria-expanded={copying === meal} onClick={() => toggleCopy(meal)}><Copy size={17}/></button>
            {view.compact && <button type="button" className="iconbtn" title="Als Vorlage speichern" aria-label={`${meal} als Vorlage speichern`} aria-expanded={savingTemplate === meal} onClick={() => toggleTemplate(meal)}><BookmarkPlus size={17}/></button>}
          </div></div>
          {copying === meal && <MealCopyForm key={`${date}-${meal}`} date={date} meal={meal} count={group.length} onCopy={onCopy} onClose={() => setCopying(current => current === meal ? null : current)}/>}
          {group.map(entry => <DiaryEntry key={`${date}-${entry.id}`} entry={entry} compact={view.compact} onEdit={openEditor} onDelete={onDelete} onQuantityChange={onQuantityChange}/>)}
          {!view.compact && <div className="meal__footer"><button type="button" className="secondary" aria-label={`${meal} als Vorlage speichern`} aria-expanded={savingTemplate === meal} onClick={() => toggleTemplate(meal)}><BookmarkPlus size={16}/>Als Vorlage speichern</button></div>}
          {savingTemplate === meal && <TemplateSaveForm key={`${date}-${meal}`} date={date} meal={meal} onClose={() => setSavingTemplate(current => current === meal ? null : current)}/>}
        </section>;
      })}
    </div>
  </>;
}
