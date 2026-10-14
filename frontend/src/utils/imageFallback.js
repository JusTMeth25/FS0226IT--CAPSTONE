import { placeholderImage } from './cardUtils.js';

/**
 * Rete di sicurezza per le immagini delle carte: se l'immagine di una fonte esterna non arriva
 * (TCGplayer risponde 403 per alcune promo) al posto del riquadro vuoto compare il segnaposto con
 * l'iniziale della carta. Vale per tutti gli <img> dell'app, senza toccare ogni componente.
 * Il backend intanto spegne le carte con l'immagine rotta (CardImageAudit), cosi' non escono piu'
 * da pacchetti, mercato e set.
 */
function isCardImage(src) {
  if (!src || src.startsWith('data:')) return false;
  try {
    const url = new URL(src, window.location.href);
    // Immagini di altri siti (le fonti delle carte) e quelle passate dal nostro proxy.
    return url.origin !== window.location.origin || /\/api\/cards\/[^/]+\/image$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function installImageFallback() {
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback || !isCardImage(img.currentSrc || img.src)) return;
    img.dataset.fallback = '1';
    img.removeAttribute('srcset');
    img.src = placeholderImage({ name: (img.alt || '?').replace(/\s*\(manca\)$/, ''), rarity: 'common' });
  }, true);
}
