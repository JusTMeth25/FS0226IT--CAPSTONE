/**
 * Impostazioni di accessibilita' di questo dispositivo (salvate in localStorage, valgono anche
 * prima del login):
 * - safe: modalita' sicura per l'epilessia e la fotosensibilita' (niente lampi ne' bagliori che
 *   pulsano, animazioni di Motion ridotte);
 * - cvd: daltonismo, '' (nessuno) | 'rg' (rosso-verde) | 'by' (blu-giallo) | 'mono' (scala di grigi);
 * - contrast: alto contrasto (testi piu' chiari, niente retino dietro le scritte);
 * - warned: l'avvertenza sulla fotosensibilita' del primo avvio e' gia' stata vista.
 *
 * Le scelte finiscono anche su <html> come data-a11y-safe, data-cvd, data-contrast: i fogli di
 * stile (styles/a11y.css) le leggono da li'. Il codice che disegna su canvas usa isSafeMode().
 */

const KEY = 'vinyldex_a11y';
const DEFAULTS = { safe: false, cvd: '', contrast: false, warned: false };
export const CVD_MODES = ['', 'rg', 'by', 'mono'];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      safe: raw.safe === true,
      cvd: CVD_MODES.includes(raw.cvd) ? raw.cvd : '',
      contrast: raw.contrast === true,
      warned: raw.warned === true
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = load();
const listeners = new Set();

/** Scrive le scelte su <html>: va chiamata prima del primo disegno (main.jsx). */
export function applyAccessibility() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.toggleAttribute('data-a11y-safe', current.safe);
  if (current.cvd) root.setAttribute('data-cvd', current.cvd);
  else root.removeAttribute('data-cvd');
  if (current.contrast) root.setAttribute('data-contrast', 'high');
  else root.removeAttribute('data-contrast');
}

export function getAccessibility() {
  return current;
}

/** Cambia una o piu' scelte: si salvano, si applicano subito e si avvisano i componenti. */
export function setAccessibility(patch) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Senza localStorage le scelte valgono fino alla chiusura della pagina.
  }
  applyAccessibility();
  listeners.forEach((fn) => fn(current));
}

export function resetAccessibility() {
  setAccessibility({ safe: false, cvd: '', contrast: false });
}

export function subscribeAccessibility(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Modalita' sicura attiva? Per gli effetti disegnati su canvas (fulmini, luci delle feste...). */
export function isSafeMode() {
  return current.safe;
}
