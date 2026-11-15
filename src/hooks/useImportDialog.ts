import {useEffect, useRef} from 'react';

// Keep keyboard interaction inside the active import/editor dialog and restore its trigger.
export function useImportDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const latestClose = useRef(onClose); latestClose.current = onClose;
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation();latestClose.current();}
      if (event.key !== 'Tab') return;
      const elements = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (!first) {event.preventDefault();return;}
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown', keydown);
    return () => {document.removeEventListener('keydown', keydown);document.body.style.overflow = previousOverflow;if(trigger?.isConnected) trigger.focus({preventScroll:true});};
  }, []);
  return ref;
}
