import {useEffect, useMemo, useRef, useState} from 'react';
import {BookOpen, CalendarDays, List, Plus, Search} from 'lucide-react';
import type {Entry, Food} from '../db';
import {fiberIncomplete, meals, stats} from '../nutrition';
import EntryEditor from './EntryEditor';
import DailySummary from './DailySummary';
import {DiaryDayCompletion} from './DayCompletion';
import DailyExtras from './DailyExtras';
import MealFilter from './MealFilter';
import type {CopyMeal} from './MealCopyForm';
import MealCard from './MealCard';
import DiarySearch from './DiarySearch';
import {useDiaryView} from '../hooks/useDiaryView';
import type {SaveQuantity} from './QuickQuantity';
import {useNavigationGuard} from './UnsavedChangesProvider';
import {scrollToRevealed} from '../hooks/useScrollReveal';
import './MealCard.css';
import type {TransferEntry} from '../entryTransfer';

export default function DiaryPage({date, foods, entries, onDateChange, onSave, onDelete, onCopy, onQuantityChange, onSaveFood, onTransfer}: {
  date: string; foods: Food[]; entries: Entry[]; onDateChange: (date: string) => void;
  onSave: (entry: Entry, conversions: Partial<Food>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopy: CopyMeal;
  onQuantityChange: SaveQuantity;
  onSaveFood: (food: Food) => Promise<void>;
  onTransfer: TransferEntry;
}) {
  const [editor, setEditor] = useState<{entry: Entry | null; initialMeal?: string; session?: string; focusFood?: boolean} | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [transferEntryId,setTransferEntryId]=useState<string | null>(null);
  const [folded,setFolded] = useState({date,meals:new Set<string>()});
  useEffect(() => {setFolded({date,meals:new Set<string>()});},[date]);
  const expandMeal = (meal: string) => setFolded(previous => {
    if(previous.date!==date || !previous.meals.has(meal))return previous;
    const meals=new Set(previous.meals);meals.delete(meal);return {date,meals};
  });
  const toggleMeal = (meal: string) => setFolded(previous => {
    const meals=new Set(previous.date===date ? previous.meals : []);
    if(meals.has(meal))meals.delete(meal);else meals.add(meal);return {date,meals};
  });
  const view = useDiaryView();
  const confirmNavigation = useNavigationGuard();
  const openEditor = (entry: Entry | null) => {
    if (editor && editor.entry?.id === entry?.id) {setEditor({...editor, entry}); return;}
    if (confirmNavigation(['entry-editor','entry-transfer:', ...(entry ? [`quantity:${entry.id}`] : [])])) {setTransferEntryId(null);if(entry)expandMeal(entry.meal);setEditor({entry});}
  };
  const addToMeal = (meal: string) => {
    if (confirmNavigation(['entry-editor','entry-transfer:'])) {setTransferEntryId(null);setEditor({entry: null, initialMeal: meal, session: crypto.randomUUID()});}
  };
  const toggleCopy = (meal: string) => {if (confirmNavigation(['meal-copy','entry-transfer:'])) {setTransferEntryId(null);setCopying(copying === meal ? null : meal);}};
  const toggleTemplate = (meal: string) => {if (confirmNavigation(['template-save','entry-transfer:'])) {setTransferEntryId(null);setSavingTemplate(savingTemplate === meal ? null : meal);}};
  const editorRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const mealsRef = useRef<HTMLDivElement>(null);
  const selectMeal = (meal: string | null) => {
    if (meal === selectedMeal) {if(meal)expandMeal(meal);window.requestAnimationFrame(() => scrollToRevealed(mealsRef.current)); return;}
    const hiddenQuantities = entries.filter(entry => meal !== null && entry.meal !== meal).map(entry => `quantity:${entry.id}`);
    const hiddenTransfers = entries.filter(entry => meal !== null && entry.meal !== meal).map(entry => `entry-transfer:${entry.id}`);
    if (!confirmNavigation(['entry-editor', 'meal-copy', 'template-save', ...hiddenQuantities, ...hiddenTransfers])) return;
    setEditor(null); setCopying(null); setSavingTemplate(null); setSearching(false); setSelectedMeal(meal);
    if(meal!==null && entries.find(entry=>entry.id===transferEntryId)?.meal!==meal)setTransferEntryId(null);
    if(meal)expandMeal(meal);
    window.requestAnimationFrame(() => scrollToRevealed(mealsRef.current));
  };
  useEffect(() => {
    if (!editor || !editorRef.current) return;
    const target = editor.focusFood ? editorRef.current.querySelector<HTMLElement>('.food-picker__trigger') : editorRef.current.querySelector<HTMLElement>('h3');
    scrollToRevealed(editor.focusFood ? target : editorRef.current);
    target?.focus({preventScroll: true});
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
        onChange={e => {if (e.target.value && e.target.value !== date && confirmNavigation()) {setTransferEntryId(null);setEditor(null); setCopying(null); setSavingTemplate(null); onDateChange(e.target.value);}}}/></label></div>
    <MealFilter entries={entries} selected={selectedMeal} onSelect={selectMeal}/>
    <DailySummary totals={totals} fiberIncomplete={fiberIncomplete(entries)}/>
    <DiaryDayCompletion key={date} date={date}/>
    <DailyExtras date={date}/>
    <div ref={mealsRef}>
    <div className="section-head"><h2>Mahlzeiten</h2>
      <div className="diary-controls"><button type="button" className="diary-view-toggle" aria-pressed={view.compact} onClick={() => {if (confirmNavigation(['quantity:','entry-transfer:'])) {setTransferEntryId(null);view.toggle();}}}><List size={17} aria-hidden="true"/>Kompakt</button>
      <button ref={searchButtonRef} type="button" className="diary-view-toggle" aria-expanded={searching} onClick={() => setSearching(value => !value)}><Search size={17} aria-hidden="true"/>Tagebuchsuche</button></div>
      <button className="primary" onClick={() => openEditor(null)}><Plus size={17}/> Lebensmittel hinzufügen</button></div>
    {searching && <DiarySearch onClose={() => {setSearching(false); searchButtonRef.current?.focus();}} onOpen={entry => {if (!confirmNavigation(entry.date === date ? ['entry-editor', 'meal-copy', 'template-save', 'quantity:','entry-transfer:'] : undefined)) return;setTransferEntryId(null); setSearching(false); setCopying(null); setSavingTemplate(null); setSelectedMeal(entry.meal);expandMeal(entry.meal); onDateChange(entry.date); setEditor({entry});}}/>}
    {editor && <div ref={editorRef} className="diary-entry-editor"><EntryEditor key={editor.entry?.id ?? editor.session ?? 'new'} foods={foods} date={date} entry={editor.entry} initialMeal={editor.initialMeal ?? selectedMeal ?? undefined} onSaveFood={onSaveFood}
      onClose={() => setEditor(null)} onSave={async (entry, conversions, keepOpen = false) => {
        await onSave(entry, conversions);
        expandMeal(entry.meal);
        if (selectedMeal !== null) setSelectedMeal(entry.meal);
        setEditor(keepOpen ? {entry:null,initialMeal:entry.meal,session:crypto.randomUUID(),focusFood:true} : null);
      }}/></div>}
    <div className={view.compact ? 'diary-meals diary-meals--compact' : 'diary-meals'}>
    {visibleEntries.length === 0 ? <div className="empty"><BookOpen size={30}/><strong>{selectedMeal ? `Noch keine Einträge für ${selectedMeal}` : 'Noch keine Einträge'}</strong><p>{selectedMeal ? 'Füge ein Lebensmittel für diese Mahlzeit hinzu.' : 'Füge dein erstes Lebensmittel für diesen Tag hinzu.'}</p>
      {selectedMeal && <button type="button" className="secondary" onClick={() => addToMeal(selectedMeal)}><Plus size={17} aria-hidden="true"/>Zu {selectedMeal} hinzufügen</button>}</div>
      : groups.filter(meal => selectedMeal === null || meal === selectedMeal).map(meal => {
        const group = visibleEntries.filter(e => e.meal === meal);
        if (!group.length) return null;
        return <MealCard key={`${date}-${meal}`} date={date} meal={meal} entries={group} compact={view.compact} collapsed={folded.date===date && folded.meals.has(meal)}
          copying={copying===meal} savingTemplate={savingTemplate===meal} onToggle={() => toggleMeal(meal)} onExpand={() => expandMeal(meal)}
          onAdd={() => addToMeal(meal)} onEdit={openEditor} onDelete={onDelete} onQuantityChange={onQuantityChange} onCopy={onCopy}
          mealOptions={groups} onTransfer={async(source,targetDate,targetMeal,mode)=>{
            const result=await onTransfer(source,targetDate,targetMeal,mode);
            if(result.date===date){expandMeal(result.meal);if(selectedMeal!==null && selectedMeal!==result.meal)setSelectedMeal(null);}
            return result;
          }}
          transferEntryId={transferEntryId} onCloseTransfer={()=>setTransferEntryId(null)} onOpenTransfer={source=>{
            if(!confirmNavigation(['entry-editor','meal-copy','template-save','entry-transfer:',`quantity:${source.id}`]))return false;
            setEditor(null);setCopying(null);setSavingTemplate(null);setTransferEntryId(source.id);return true;
          }}
          onToggleCopy={() => toggleCopy(meal)} onCloseCopy={() => setCopying(current => current===meal ? null : current)}
          onToggleTemplate={() => toggleTemplate(meal)} onCloseTemplate={() => setSavingTemplate(current => current===meal ? null : current)}/>;
      })}
    </div>
    </div>
  </div>;
}
