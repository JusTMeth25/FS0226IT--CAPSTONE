import { useEffect } from 'react';
import { useGame } from './useGame.js';
import { findPackById } from '../data/packs.js';
import { freePackNotificationsOn, showFreePackNotification } from '../services/pwa.js';

/**
 * Programma la notifica "pacchetto gratis pronto" per quando scade l'attesa del pacchetto base.
 * Si riprogramma da sola dopo ogni apertura (cambia lastFreePackAt).
 */
export function useFreePackNotifier() {
  const { lastFreePackAt } = useGame();

  useEffect(() => {
    if (!lastFreePackAt || !freePackNotificationsOn()) return undefined;
    const base = findPackById('pack-base');
    const last = typeof lastFreePackAt === 'number' ? lastFreePackAt : new Date(lastFreePackAt).getTime();
    const readyAt = last + (base?.freeCooldownHours || 4) * 3_600_000;
    const wait = readyAt - Date.now();
    // Gia' pronto o troppo lontano per un timer del browser (oltre ~24 giorni): niente.
    if (wait <= 0 || wait > 2_000_000_000) return undefined;
    const timer = setTimeout(() => { showFreePackNotification(); }, wait);
    return () => clearTimeout(timer);
  }, [lastFreePackAt]);
}
