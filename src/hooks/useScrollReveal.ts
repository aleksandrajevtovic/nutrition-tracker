import {useEffect, useRef, type MouseEvent} from 'react';

export function scrollToRevealed(element: HTMLElement | null) {
  if (!element?.isConnected || !element.getClientRects().length) return;
  element.classList.add('scroll-reveal');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({block: 'start', inline: 'nearest', behavior: reduced ? 'instant' : 'smooth'});
}

// Run after the expanded content is in the DOM, once per opening rather than per edit.
export function useScrollReveal<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => scrollToRevealed(ref.current));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  return ref;
}

// Native details expand after their summary's click (including keyboard activation).
export function revealOpeningDetails(event: MouseEvent<HTMLElement>) {
  const details = event.currentTarget.closest('details');
  if (!details || details.open) return;
  window.requestAnimationFrame(() => {if (details.open) scrollToRevealed(details);});
}
