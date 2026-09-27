import { EARRINGS, NECKLACES, OUTFITS, WATCHES, formatLook } from '../sprites/avatar.js';

/**
 * Consigli del sarto dell'atelier: guarda come sei vestito e cosa hai nel guardaroba, e propone
 * un abbinamento completo (capo, orologio, gioielli, scarpe, accessorio). Se manca qualcosa lo dice, con
 * il prezzo, ma fa provare lo stesso l'insieme.
 */

/** Orologio che sta meglio con ogni capo (indici di WATCHES). */
const WATCH_FOR = { 1: 3, 2: 4, 3: 2, 4: 5, 5: 6, 6: 6, 7: 1, 8: 2, 9: 7, 10: 8, 11: 10, 12: 4, 13: 9 };
/** Scarpe (indici di SHOES): nere per i completi, rosse con l'abito rosso, bianche con la tuta. */
const SHOES_FOR = { 1: 0, 2: 0, 3: 2, 4: 4, 5: 0, 6: 1, 7: 1, 8: 0, 9: 4, 10: 0, 11: 4, 12: 0, 13: 1 };
/** Accessorio: occhiali da sole con il blazer, la pelle e il trench. */
const ACCESSORY_FOR = { 5: 2, 7: 2, 9: 2 };
/** Gioielli con ogni capo: collana e orecchini (indici di NECKLACES ed EARRINGS), 0 niente. */
const JEWELS_FOR = { 2: [0, 1], 3: [5, 5], 4: [0, 3], 8: [3, 1], 10: [0, 1], 11: [6, 0], 12: [1, 3], 13: [1, 2], 5: [2, 0] };

const LINES = {
  1: 'Il gessato blu e\' il classico che non sbaglia mai: scarpe nere lucide e un Nautilo al polso, sobrio ma importante.',
  2: 'Per la sera lo smoking: niente di vistoso al polso, un Calatrava sottile in oro rosa. Eleganza vera.',
  3: 'Rosso rubino: collier e orecchini di rubini, scarpe rosse e un Daytona al polso. Brilli quanto loro.',
  4: 'Il cammello chiama un orologio sportivo ma raffinato: la Quercia Reale in acciaio. E stivaletti.',
  5: 'Pelle nera, occhiali scuri e l\'Offshore in ceramica: grinta da quartiere.',
  6: 'Con la tuta firmata sneakers bianche e un Offshore nero: comodo ma di lusso.',
  7: 'Blazer bianco da yacht: sneakers bianche, occhiali da sole e il Submarino verde. Estate tutto l\'anno.',
  8: 'Paillettes d\'oro: riviera di diamanti, punti luce e il Daytona d\'oro. Resti tu la luce della festa.',
  9: 'Il trench vuole occhiali scuri, stivaletti e il GMT Pepsi: elegante anche sotto la pioggia.',
  10: 'Smoking bianco da gran gala: scarpe nere lucide, punti luce e il Day-Date in platino.',
  11: 'Velluto bordeaux e camicia aperta: medaglione d\'oro e il Codice 11.59. Rilassato ma di classe.',
  12: 'Kimono di seta blu: perle al collo e alle orecchie, un Calatrava sottile al polso.',
  13: 'Tailleur rosa cipria: perle, cerchi d\'oro e l\'Aquanaut verde per un tocco moderno.'
};

/** Prima scelta di capo quando non se ne indossa ancora uno. */
function suggestedOutfit(parts, owned) {
  const mine = Array.from({ length: OUTFITS.length - 1 }, (_, i) => i + 1).filter((i) => owned.has(`o${i}`));
  if (mine.length) return mine[Math.floor(Math.random() * mine.length)];
  return parts.b === 1 ? 3 : 1;
}

export function tailorAdvice(parts, owned, items) {
  const outfit = parts.o || suggestedOutfit(parts, owned);
  const watch = WATCH_FOR[outfit];
  const [necklace, earrings] = JEWELS_FOR[outfit] || [0, 0];
  const next = { ...parts, o: outfit, w: watch, f: SHOES_FOR[outfit] ?? parts.f, n: necklace, e: earrings };
  if (ACCESSORY_FOR[outfit] !== undefined) next.a = ACCESSORY_FOR[outfit];
  const wanted = [`o${outfit}`, `w${watch}`];
  if (necklace) wanted.push(`n${necklace}`);
  if (earrings) wanted.push(`e${earrings}`);
  const missing = wanted.filter((key) => !owned.has(key));
  const priceOf = (key) => items.find((i) => i.key === key)?.price;
  let text = LINES[outfit];
  if (!parts.o) text = `Ti vedo bene con ${OUTFITS[outfit].toLowerCase()}. ${text}`;
  if (missing.length) {
    const names = { o: OUTFITS[outfit], w: WATCHES[watch], n: NECKLACES[necklace], e: EARRINGS[earrings] };
    const list = missing.map((key) => `${names[key[0]]} (${priceOf(key) ?? '?'} gold)`).join(', ');
    text += ` Ti manca ${list}: provalo e poi decidi.`;
  }
  return { text, look: formatLook(next), missing };
}
