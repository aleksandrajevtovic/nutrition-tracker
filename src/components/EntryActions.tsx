import {useEffect, useId, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRightLeft, Ellipsis, Pencil, Trash2} from 'lucide-react';
import './EntryActions.css';

export default function EntryActions({name, buttonRef, transferring, visible, onEdit, onTransfer, onDelete}: {
  name: string; buttonRef: RefObject<HTMLButtonElement | null>; transferring: boolean; visible: boolean;
  onEdit: () => void; onTransfer: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null), last = useRef(false);
  const id = useId();
  const close = (restore = false) => {setOpen(false);if (restore) buttonRef.current?.focus({preventScroll:true});};
  const items = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
  const positionMenu = () => {
    if (!menu.current || !buttonRef.current) return;
    const viewport = window.visualViewport, margin = 8;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
    const panel = menu.current, anchor = buttonRef.current.getBoundingClientRect();
    panel.style.maxWidth = `${Math.max(0,width - margin * 2)}px`;
    panel.style.maxHeight = `${Math.max(0,height - margin * 2)}px`;
    const bounds = panel.getBoundingClientRect();
    const y = anchor.bottom + 6 + bounds.height <= top + height - margin ? anchor.bottom + 6 : anchor.top - bounds.height - 6;
    panel.style.left = `${Math.max(left + margin,Math.min(anchor.right - bounds.width,left + width - bounds.width - margin))}px`;
    panel.style.top = `${Math.max(top + margin,Math.min(y,top + height - bounds.height - margin))}px`;
    panel.style.visibility = 'visible';
  };
  useLayoutEffect(() => {
    if (!open || !visible) return;
    positionMenu();
    const enabled = items();(last.current ? enabled.at(-1) : enabled[0])?.focus({preventScroll:true});
  }, [open, visible, buttonRef]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) close();
    };
    const scroll = (event: Event) => {if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) positionMenu();};
    const resize = () => positionMenu();
    const gesture = (event: Event) => {if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) close();};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('wheel',gesture,{passive:true});document.addEventListener('touchmove',gesture,{passive:true});
    window.addEventListener('scroll',scroll,true);window.addEventListener('resize',resize);
    window.visualViewport?.addEventListener('resize',resize);
    return () => {document.removeEventListener('pointerdown',outside);document.removeEventListener('wheel',gesture);document.removeEventListener('touchmove',gesture);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};
  }, [open, buttonRef]);
  useEffect(() => {if (!visible) setOpen(false);}, [visible]);
  const act = (action: () => void) => {close(true);action();};
  return <div className="actions entry-actions">
    <button ref={buttonRef} type="button" className="entry-actions__trigger" aria-label={`Aktionen für ${name}`} title="Aktionen" aria-haspopup="menu" aria-expanded={open && visible} aria-controls={open && visible ? id : undefined}
      onClick={() => {last.current=false;if(open)close();else setOpen(true);}}
      onKeyDown={event => {
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();last.current=event.key==='ArrowUp';if(open){const enabled=items();(last.current?enabled.at(-1):enabled[0])?.focus();}else setOpen(true);}
        if(event.key==='Escape'&&open){event.preventDefault();close(true);}
      }}><Ellipsis size={20} aria-hidden="true"/></button>
    {open && visible && createPortal(<div ref={menu} id={id} className="entry-actions__menu" role="menu" aria-label={`Aktionen für ${name}`}
      onBlurCapture={event => {if(!event.currentTarget.contains(event.relatedTarget as Node|null)&&event.relatedTarget!==buttonRef.current)close();}}
      onKeyDown={event => {
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
        if(event.key==='Tab'){close(true);return;}
        const enabled=items(),current=enabled.indexOf(document.activeElement as HTMLButtonElement);
        const next=event.key==='ArrowDown'?(current+1)%enabled.length:event.key==='ArrowUp'?(current-1+enabled.length)%enabled.length:event.key==='Home'?0:event.key==='End'?enabled.length-1:undefined;
        if(next!==undefined){event.preventDefault();enabled[next]?.focus();}
      }}>
      <button type="button" role="menuitem" tabIndex={-1} disabled={transferring} aria-label={`${name} bearbeiten`} onClick={()=>act(onEdit)}><Pencil size={17} aria-hidden="true"/>Bearbeiten</button>
      <button type="button" role="menuitem" tabIndex={-1} aria-label={transferring?`${name}: Übertragung schließen`:`${name} kopieren oder verschieben`} onClick={()=>act(onTransfer)}><ArrowRightLeft size={17} aria-hidden="true"/>{transferring?'Übertragung schließen':'Kopieren / Verschieben'}</button>
      <button type="button" role="menuitem" tabIndex={-1} className="entry-actions__delete" disabled={transferring} aria-label={`${name} löschen`} onClick={()=>act(onDelete)}><Trash2 size={17} aria-hidden="true"/>Löschen</button>
    </div>,document.body)}
  </div>;
}
