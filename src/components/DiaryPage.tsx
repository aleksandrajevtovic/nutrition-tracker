import {useEffect, useMemo, useRef, useState} from 'react';
import {BookmarkPlus, BookOpen, CalendarDays, Copy, List, Plus, Search} from 'lucide-react';
import type {Entry, Food} from '../db';
import {meals, stats} from '../nutrition';
import EntryEditor from './EntryEditor';
import DailySummary from './DailySummary';
import DailyExtras from './DailyExtras';
import MealFilter from './MealFilter';
import MealCopyForm, {type CopyMeal} from './MealCopyForm';
import TemplateSaveForm from './TemplateSaveForm';
import DiaryEntry from './DiaryEntry';
import DiarySearch from './DiarySearch';
import {useDiaryView} from '../hooks/useDiaryView';
import type {SaveQuantity} from './QuickQuantity';
import {useNavigationGuard} from './UnsavedChangesProvider';
import {scrollToRevealed} from '../hooks/useScrollReveal';
import './MealCard.css';

export default function DiaryPage({date, foods, entries, onDateChange, onSave, onDelete, onCopy, onQuantityChange, onSaveFood}: {
  date: string; foods: Food[]; entries: Entry[]; onDateChange: (date: string) => void;
  onSave: (entry: Entry, conversions: Partial<Food>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopy: CopyMeal;
  onQuantityChange: SaveQuantity;
  onSaveFood: (food: Food) => Promise<void>;
}) {
  const [editor, setEditor] = useState<{entry: Entry | null; initialMeal?: string; session?: string} | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const view = useDiaryView();
  const confirmNavigation = useNavigationGuard();
  const openEditor = (entry: Entry | null) => {
    if (editor && editor.entry?.id === entry?.id) {setEditor({...editor, entry}); return;}
    if (confirmNavigation(['entry-editor', ...(entry ? [`quantity:${entry.id}`] : [])])) setEditor({entry});
  };
  const addToMeal = (meal: string) => {
    if (confirmNavigation(['entry-editor'])) setEditor({entry: null, initialMeal: meal, session: crypto.randomUUID()});
  };
  const toggleCopy = (meal: string) => {if (confirmNavigation(['meal-copy'])) setCopying(copying === meal ? null : meal);};
  const toggleTemplate = (meal: string) => {if (confirmNavigation(['template-save'])) setSavingTemplate(savingTemplate === meal ? null : meal);};
  const editorRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const mealsRef = useRef<HTMLDivElement>(null);
  const selectMeal = (meal: string | null) => {
    if (meal === selectedMeal) {window.requestAnimationFrame(() => scrollToRevealed(mealsRef.current)); return;}
    const hiddenQuantities = entries.filter(entry => meal !== null && entry.meal !== meal).map(entry => `quantity:${entry.id}`);
    if (!confirmNavigation(['entry-editor', 'meal-copy', 'template-save', ...hiddenQuantities])) return;
    setEditor(null); setCopying(null); setSavingTemplate(null); setSearching(false); setSelectedMeal(meal);
    window.requestAnimationFrame(() => scrollToRevealed(mealsRef.current));
  };
  useEffect(() => {
    if (!editor || !editorRef.current) return;
    scrollToRevealed(editorRef.current);
    editorRef.current.querySelector<HTMLElement>('h3')?.focus({preventScroll: true});
  }, [editor]);
  const totals = useMemo(() => entries.reduce((sum, entry) => {
    const values = stats(entry.foodSnapshot, entry.grams);
    for (const key of Object.keys(values) as (keyof typeof values)[]) sum[key] += values[key];
    return sum;
  }, {kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0}), [entries]);
  // Include old/custom meal names so historical entries are never hidden.
  const groups = Array.from(new Set([...meals, ...entries.map(e => e.meal), ...(selectedMeal ? [selectedMeal] : [])]));
  const visibleEntries = selectedMeal === null ? entries : entries.filter(entry => entry.meal === selectedMeal);

  return <div className="diary-page">
    <div className="heading"><div><span className="eyebrow">TAGESÜBERSICHT</span><h1>Mein Ernährungstagebuch</h1></div>
      <label className="date"><CalendarDays size={17}/><input aria-label="Datum" type="date" required value={date}
        onChange={e => {if (e.target.value && e.target.value !== date && confirmNavigation()) {setEditor(null); setCopying(null); setSavingTemplate(null); onDateChange(e.target.value);}}}/></label></div>
    <MealFilter entries={entries} selected={selectedMeal} onSelect={selectMeal}/>
    <DailySummary totals={totals}/>
    <DailyExtras date={date}/>
    <div ref={mealsRef}>
    <div className="section-head"><h2>Mahlzeiten</h2>
      <div className="diary-controls"><button type="button" className="diary-view-toggle" aria-pressed={view.compact} onClick={() => {if (confirmNavigation(['quantity:'])) view.toggle();}}><List size={17} aria-hidden="true"/>Kompakt</button>
      <button ref={searchButtonRef} type="button" className="diary-view-toggle" aria-expanded={searching} onClick={() => setSearching(value => !value)}><Search size={17} aria-hidden="true"/>Tagebuchsuche</button></div>
      <button className="primary" onClick={() => openEditor(null)}><Plus size={17}/> Lebensmittel hinzufügen</button></div>
    {searching && <DiarySearch onClose={() => {setSearching(false); searchButtonRef.current?.focus();}} onOpen={entry => {if (!confirmNavigation(entry.date === date ? ['entry-editor', 'meal-copy', 'template-save', 'quantity:'] : undefined)) return; setSearching(false); setCopying(null); setSavingTemplate(null); setSelectedMeal(entry.meal); onDateChange(entry.date); setEditor({entry});}}/>}
    {editor && <div ref={editorRef} className="diary-entry-editor"><EntryEditor key={editor.entry?.id ?? editor.session ?? 'new'} foods={foods} date={date} entry={editor.entry} initialMeal={editor.initialMeal ?? selectedMeal ?? undefined} onSaveFood={onSaveFood}
      onClose={() => setEditor(null)} onSave={async (entry, conversions) => {await onSave(entry, conversions); if (selectedMeal !== null) setSelectedMeal(entry.meal); setEditor(null);}}/></div>}
    <div className={view.compact ? 'diary-meals diary-meals--compact' : 'diary-meals'}>
    {visibleEntries.length === 0 ? <div className="empty"><BookOpen size={30}/><strong>{selectedMeal ? `Noch keine Einträge für ${selectedMeal}` : 'Noch keine Einträge'}</strong><p>{selectedMeal ? 'Füge ein Lebensmittel für diese Mahlzeit hinzu.' : 'Füge dein erstes Lebensmittel für diesen Tag hinzu.'}</p>
      {selectedMeal && <button type="button" className="secondary" onClick={() => addToMeal(selectedMeal)}><Plus size={17} aria-hidden="true"/>Zu {selectedMeal} hinzufügen</button>}</div>
      : groups.filter(meal => selectedMeal === null || meal === selectedMeal).map(meal => {
        const group = visibleEntries.filter(e => e.meal === meal);
        if (!group.length) return null;
        return <section className="meal panel" key={meal}>
          <div className="meal__heading"><h3 aria-label={meal}><button type="button" className="meal__add" title={`Lebensmittel zu ${meal} hinzufügen`} aria-label={`Lebensmittel zu ${meal} hinzufügen`} onClick={() => addToMeal(meal)}>
            <span>{meal}</span><Plus size={17} aria-hidden="true"/></button></h3><div className="meal__tools">
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
    </div>
  </div>;
}
