import { createElement } from 'react';
import '../../styles/phantom/phantom-title.css';

/** Variazione fissa per lettera (sempre la stessa a ogni render): rotazione, tassello, scala. */
function tile(i, ch) {
  const h = (i * 7919 + ch.charCodeAt(0) * 104729) % 997;
  return {
    rot: ((h % 13) - 6) * 0.9,          // da -5,4 a +5,4 gradi
    kind: h % 5 === 0 ? 'red' : h % 3 === 0 ? 'paper' : 'ink',
    lift: (h % 7) - 3                    // spostamento verticale in px
  };
}

/**
 * Titolo in stile Persona 5.
 * - variant "ransom": ogni lettera su un tassello ritagliato (bianco, nero o magenta), un po'
 *   ruotato, come le lettere ritagliate dai giornali. Per i titoli brevi delle pagine.
 * - variant "headline": testo enorme bianco con l'ombra netta; la parola in `highlight` sta in un
 *   blocco bianco tagliato, scritta in magenta. Per la copertina.
 * Il testo intero e' sempre nell'aria-label: i lettori di schermo non leggono lettera per lettera.
 */
export default function PhantomTitle({ as = 'h2', text, variant = 'ransom', highlight, className = '', ...rest }) {
  const label = text;
  if (variant === 'headline') {
    const lines = text.split('\n');
    return createElement(as, { className: `p5-headline ${className}`, 'aria-label': label.replace(/\n/g, ' '), ...rest },
      lines.map((line, li) => (
        <span key={li} className="p5-headline-line" aria-hidden="true">
          {line.split(/(\s+)/).map((word, wi) => (highlight && word.toLowerCase() === highlight.toLowerCase()
            ? <span key={wi} className="p5-headline-mark">{word}</span>
            : <span key={wi}>{word}</span>))}
        </span>
      )));
  }
  let n = 0;
  return createElement(as, { className: `p5-ransom ${className}`, 'aria-label': label, ...rest },
    text.split(' ').map((word, wi) => (
      <span key={wi} className="p5-ransom-word" aria-hidden="true">
        {[...word].map((ch) => {
          const t = tile(n++, ch);
          return (
            <span key={n} className={`p5-ransom-tile is-${t.kind}`} style={{ '--r': `${t.rot}deg`, '--y': `${t.lift}px` }}>{ch}</span>
          );
        })}
      </span>
    )));
}
