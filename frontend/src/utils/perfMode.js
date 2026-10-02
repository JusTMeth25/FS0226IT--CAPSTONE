/**
 * Modalita' leggera per telefoni, tablet e computer poco potenti.
 *
 * Lo sfondo animato (aurora, particelle) sotto i pannelli in vetro sfocato costringe il browser
 * a risfocare ogni pannello a ogni fotogramma e a ogni scorrimento: su un PC con una buona
 * scheda video non si nota, su un telefono fa scattare la pagina e scalda il dispositivo.
 * Con la classe "perf-lite" sull'elemento <html> i fogli di stile tolgono gli effetti piu'
 * costosi (sfocatura dietro ai pannelli, sfondo in movimento, bagliori che pulsano) lasciando
 * colori e grafica uguali.
 */
export function isLiteDevice() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  const saveData = navigator.connection?.saveData;
  return Boolean(coarse || cores <= 4 || memory <= 4 || saveData);
}

export function applyPerfMode() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('perf-lite', isLiteDevice());
}

/** Risoluzione delle scene 3D: sui dispositivi leggeri al massimo 1,5 pixel per punto. */
export function sceneDpr() {
  return isLiteDevice() ? [1, 1.5] : [1, 2];
}
