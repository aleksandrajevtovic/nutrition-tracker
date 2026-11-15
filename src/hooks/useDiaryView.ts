import {useState} from 'react';
import {useToast} from '../components/ToastProvider';

const preferenceKey = 'nutrition-tracker:compact-diary';

export function useDiaryView() {
  const notify = useToast();
  const [compact, setCompact] = useState(() => {
    try {return localStorage.getItem(preferenceKey) !== 'false';} catch {return true;}
  });

  function toggle() {
    const next = !compact;
    setCompact(next);
    try {localStorage.setItem(preferenceKey, String(next));}
    catch {notify('Die Ansicht wurde geändert. Deine Auswahl konnte für den nächsten Besuch nicht gespeichert werden.', 'error');}
  }

  return {compact, toggle};
}
