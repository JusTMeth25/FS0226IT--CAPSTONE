import { Capacitor } from '@capacitor/core';

/**
 * Orientamento dello schermo su telefono e tablet.
 *
 * - Nell'hotel si gioca in orizzontale: la stanza si vede piu' larga.
 * - Fuori dall'hotel decide il giocatore: automatico (segue il telefono), verticale o orizzontale.
 *
 * Nell'app (Capacitor) lo schermo si blocca davvero con il plugin ScreenOrientation. Nel browser
 * il blocco si puo' solo a schermo intero e non su iPhone (Safari non lo permette): li' l'hotel
 * chiede di girare il telefono (RotatePrompt) e la scelta vale quando il browser la consente.
 */

const KEY = 'vinyldex_orientation';
export const ORIENTATIONS = [
  ['auto', 'Automatico', 'ph-device-rotate'],
  ['portrait', 'Verticale', 'ph-device-mobile'],
  ['landscape', 'Orizzontale', 'ph-device-mobile-camera']
];

export const isNativeApp = Capacitor.isNativePlatform();

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Telefono o tablet (schermo tattile senza mouse): solo li' l'orientamento conta. */
export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
}

export function getOrientationPref() {
  try {
    const value = localStorage.getItem(KEY);
    return ORIENTATIONS.some(([key]) => key === value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

const listeners = new Set();
export function onOrientationPref(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let nativePlugin = null;
async function plugin() {
  if (!isNativeApp) return null;
  if (!nativePlugin) nativePlugin = import('@capacitor/screen-orientation').then((m) => m.ScreenOrientation).catch(() => null);
  return nativePlugin;
}

/** Il browser puo' bloccare l'orientamento? (Android a schermo intero; mai su iPhone.) */
export function canLockOnWeb() {
  return !isNativeApp && !isIOS() && typeof screen !== 'undefined' && typeof screen.orientation?.lock === 'function';
}

async function lock(target) {
  const native = await plugin();
  if (native) {
    try {
      if (target === 'auto') await native.unlock();
      else await native.lock({ orientation: target });
    } catch {
      // Orientamento non supportato su questo dispositivo: si resta come si e'.
    }
    return;
  }
  if (!canLockOnWeb() || !document.fullscreenElement) return;
  try {
    if (target === 'auto') screen.orientation.unlock();
    else await screen.orientation.lock(target);
  } catch {
    // Il browser ha rifiutato (non a schermo intero o non supportato).
  }
}

/** Schermo intero chiesto dall'hotel (nel browser): uscendo dall'hotel si richiude. */
let hotelFullscreen = false;

/** Applica l'orientamento giusto per la pagina: orizzontale nell'hotel, altrimenti la scelta. */
export async function applyOrientation(inHotel) {
  const target = inHotel ? 'landscape' : getOrientationPref();
  if (!inHotel && hotelFullscreen && !isNativeApp) {
    hotelFullscreen = false;
    if (target === 'auto' && document.fullscreenElement) {
      try {
        screen.orientation?.unlock?.();
        await document.exitFullscreen();
      } catch {
        // Gia' uscito.
      }
      return;
    }
  }
  return lock(target);
}

/**
 * Salva la scelta del giocatore. Nel browser (Android) per bloccare serve lo schermo intero:
 * lo si chiede qui, dentro il tocco sul pulsante, come vogliono i browser.
 */
export async function setOrientationPref(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Senza localStorage la scelta vale finche' resta aperta la pagina.
  }
  listeners.forEach((fn) => fn(value));
  if (!isNativeApp && canLockOnWeb()) {
    try {
      if (value === 'auto') {
        if (document.fullscreenElement) await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch {
      // Schermo intero rifiutato: la scelta resta salvata per la prossima volta.
    }
  }
  return lock(value);
}

/** Nel browser: schermo intero e orizzontale per l'hotel (va chiamato dentro un tocco). */
export async function requestHotelLandscape() {
  if (!canLockOnWeb()) return false;
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      hotelFullscreen = true;
    }
    await screen.orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}
