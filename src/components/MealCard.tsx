import {useId} from 'react';
import {BookmarkPlus, ChevronDown, Copy, Plus} from 'lucide-react';
import type {Entry} from '../db';
import {stats} from '../nutrition';
import DiaryEntry from './DiaryEntry';
import MealCopyForm, {type CopyMeal} from './MealCopyForm';
import TemplateSaveForm from './TemplateSaveForm';
import type {SaveQuantity} from './QuickQuantity';
import './MealCard.css';
import type {TransferEntry} from '../entryTransfer';

export default function MealCard({meal,date,entries,compact,collapsed,copying,savingTemplate,onToggle,onExpand,onAdd,onEdit,onDelete,onQuantityChange,onCopy,onToggleCopy,onCloseCopy,onToggleTemplate,onCloseTemplate,onTransfer,mealOptions,transferEntryId,onOpenTransfer,onCloseTransfer}: {
  meal: string;date: string;entries: Entry[];compact: boolean;collapsed: boolean;copying: boolean;savingTemplate: boolean;
  onToggle: () => void;onExpand: () => void;onAdd: () => void;onEdit: (entry: Entry) => void;
  onDelete: (id: string) => Promise<void>;onQuantityChange: SaveQuantity;onCopy: CopyMeal;
  onToggleCopy: () => void;onCloseCopy: () => void;onToggleTemplate: () => void;onCloseTemplate: () => void;
  onTransfer: TransferEntry;mealOptions: string[];
  transferEntryId: string | null;onOpenTransfer: (entry: Entry) => boolean;onCloseTransfer: () => void;
}) {
  const id=useId();
  return <section className={`meal panel${collapsed ? ' meal--collapsed' : ''}`} aria-labelledby={`${id}-title`}>
    <div className="meal__heading"><div className="meal__identity"><h3 id={`${id}-title`} aria-label={meal}>
      <button type="button" className="meal__toggle" aria-label={`${meal} ${collapsed ? 'aufklappen' : 'einklappen'}`} aria-expanded={!collapsed} aria-controls={`${id}-content`} onClick={onToggle}><span>{meal}</span><ChevronDown size={17} aria-hidden="true"/></button>
    </h3><button type="button" className="iconbtn meal__add" title={`Lebensmittel zu ${meal} hinzufügen`} aria-label={`Lebensmittel zu ${meal} hinzufügen`} onClick={onAdd}><Plus size={17} aria-hidden="true"/></button></div>
    <div className="meal__tools"><b className="meal__calories">{Math.round(entries.reduce((sum,entry) => sum+stats(entry.foodSnapshot,entry.grams).kcal,0))} <small>kcal</small></b>
      <button type="button" hidden={collapsed} className="iconbtn" title="Mahlzeit kopieren" aria-label={`${meal} kopieren`} aria-expanded={copying && !collapsed} onClick={() => {onExpand();if(!collapsed || !copying)onToggleCopy();}}><Copy size={17}/></button>
      {compact && <button type="button" hidden={collapsed} className="iconbtn" title="Als Vorlage speichern" aria-label={`${meal} als Vorlage speichern`} aria-expanded={savingTemplate && !collapsed} onClick={() => {onExpand();if(!collapsed || !savingTemplate)onToggleTemplate();}}><BookmarkPlus size={17}/></button>}
    </div></div>
    <div id={`${id}-content`} className="meal__content" hidden={collapsed}>
      {copying && <MealCopyForm key={`${date}-${meal}`} date={date} meal={meal} entries={entries} onCopy={onCopy} onClose={onCloseCopy}/>}
      {entries.map(entry => <DiaryEntry key={`${date}-${entry.id}`} entry={entry} compact={compact} onEdit={onEdit} onDelete={onDelete} onQuantityChange={onQuantityChange} onTransfer={onTransfer} mealOptions={mealOptions} transferring={transferEntryId===entry.id} onOpenTransfer={onOpenTransfer} onCloseTransfer={onCloseTransfer}/>)}
      {!compact && <div className="meal__footer"><button type="button" className="secondary" aria-label={`${meal} als Vorlage speichern`} aria-expanded={savingTemplate} onClick={onToggleTemplate}><BookmarkPlus size={16}/>Als Vorlage speichern</button></div>}
      {savingTemplate && <TemplateSaveForm key={`${date}-${meal}`} date={date} meal={meal} onClose={onCloseTemplate}/>}
    </div>
  </section>;
}
