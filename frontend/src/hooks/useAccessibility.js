import { useSyncExternalStore } from 'react';
import { getAccessibility, subscribeAccessibility } from '../services/accessibility.js';

/** Impostazioni di accessibilita' correnti ({ safe, cvd, contrast, warned }), aggiornate dal vivo. */
export function useAccessibility() {
  return useSyncExternalStore(subscribeAccessibility, getAccessibility, getAccessibility);
}
