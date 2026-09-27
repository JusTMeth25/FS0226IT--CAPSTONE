import { OUTFITS, WATCHES, formatLook } from '../sprites/avatar.js';

/**
 * Consigli del sarto dell'atelier: guarda come sei vestito e cosa hai nel guardaroba, e propone
 * un abbinamento completo (capo, orologio, scarpe, accessorio). Se manca qualcosa lo dice, con
 * il prezzo, ma fa provare lo stesso l'insieme.
 */

/** Orologio che sta meglio con ogni capo (indici di WATCHES). */
const WATCH_FOR = { 1: 3, 2: 4, 3: 2, 4: 5, 5: 6, 6: 6, 7: 1, 8: 2 };
/** Scarpe (indici di SHOES): nere per i completi, rosse con l'abito rosso, bianche con la tuta. */
const SHOES_FOR = { 1: 0, 2: 0, 3: 2, 4: 4, 5: 0, 6: 1, 7: 1, 8: 0 };
/** Accessorio: occhiali da sole con il blazer e la pelle, orecchino con gli abiti. */
const ACCESSORY_FOR = { 3: 5, 5: 2, 7: 2, 8: 5 };

const LINES = {
  1: 'Il gessato blu e\' il classico che non sbaglia mai: scarpe nere lucide e un Nautilo al polso, sobrio ma importante.',
  2: 'Per la sera lo smoking: niente di vistoso al polso, un Calatrava sottile in oro rosa. Eleganza vera.',
  3: 'Rosso rubino con le scarpe rosse e un orecchino d\'oro. Al polso un Daytona: brilla quanto te.',
  4: 'Il cammello chiama un orologio sportivo ma raffinato: la Quercia Reale in acciaio. E stivaletti.',
  5: 'Pelle nera, occhiali scuri e l\'Offshore in ceramica: grinta da quartiere.',
  6: 'Con la tuta firmata sneakers bianche e un Offshore nero: comodo ma di lusso.',
  7: 'Blazer bianco da yacht: sneakers bianche, occhiali da sole e il Submarino verde. Estate tutto l\'anno.',
  8: 'Paillettes d\'oro: orecchino e Daytona d\'oro, e resti tu la luce della festa.'
};

/** Prima scelta di capo quando non se ne indossa ancora uno. */
function suggestedOutfit(parts, owned) {
  const mine = [1, 2, 3, 4, 5, 6, 7, 8].filter((i) => owned.has(`o${i}`));
  if (mine.length) return mine[Math.floor(Math.random() * mine.length)];
  return parts.b === 1 ? 3 : 1;
}

export function tailorAdvice(parts, owned, items) {
  const outfit = parts.o || suggestedOutfit(parts, owned);
  const watch = WATCH_FOR[outfit];
  const next = { ...parts, o: outfit, w: watch, f: SHOES_FOR[outfit] ?? parts.f };
  if (ACCESSORY_FOR[outfit] !== undefined) next.a = ACCESSORY_FOR[outfit];
  const missing = [`o${outfit}`, `w${watch}`].filter((key) => !owned.has(key));
  const priceOf = (key) => items.find((i) => i.key === key)?.price;
  let text = LINES[outfit];
  if (!parts.o) text = `Ti vedo bene con ${OUTFITS[outfit].toLowerCase()}. ${text}`;
  if (missing.length) {
    const list = missing.map((key) => {
      const name = key.startsWith('o') ? OUTFITS[outfit] : WATCHES[watch];
      return `${name} (${priceOf(key) ?? '?'} gold)`;
    }).join(' e ');
    text += ` Ti manca ${list}: provalo e poi decidi.`;
  }
  return { text, look: formatLook(next), missing };
}
