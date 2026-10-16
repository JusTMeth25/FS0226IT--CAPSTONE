import { m, useReducedMotion } from 'motion/react';
import StarBurst from '../phantom/StarBurst.jsx';
import PhantomTitle from '../phantom/PhantomTitle.jsx';

/*
 * Momenti forti in stile Phantom (Persona 5) per le schermate di gioco: battaglie, torneo,
 * apertura dei pacchetti. Tutto decorativo (aria-hidden) e fermo con "riduci animazioni".
 * I preset di movimento stanno in phantomMotion.js.
 */

/**
 * Testo che "piomba" sullo schermo: grande e storto, poi si ferma al suo posto.
 * `tilt` e' l'inclinazione finale (la trasformazione la gestisce Motion, non il CSS).
 */
export function SlamIn({ children, className = '', delay = 0, tilt = 0 }) {
  return (
    <m.span
      className={className}
      initial={{ scale: 2.4, rotate: -16, opacity: 0 }}
      animate={{ scale: 1, rotate: tilt, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 620, damping: 24, delay }}
    >
      {children}
    </m.span>
  );
}

/**
 * Fondo della schermata di risultato.
 * - win / champion: raggi a ventaglio, stella grande che esplode e due piccole che seguono.
 * - lose: una lastra nera diagonale che scende, niente festa.
 * - draw: una lastra bianca, neutra.
 * Con "riduci animazioni" i raggi compaiono gia' al loro posto (MotionConfig ferma solo le
 * trasformazioni, non l'opacita' e la scala dei ventagli: qui si decide con useReducedMotion).
 */
export function ResultBackdrop({ tone }) {
  const reduce = useReducedMotion();
  const festive = tone === 'win' || tone === 'champion';
  return (
    <div className={`p5-result-bg is-${tone}`} aria-hidden="true">
      {festive ? (
        <>
          <m.span
            className="p5-result-rays"
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.2, 1, 0.3, 1] }}
          />
          <m.span
            className="p5-result-star p5-result-star-main"
            initial={{ scale: 0, rotate: -50 }}
            animate={{ scale: 1, rotate: -10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.12 }}
          >
            <StarBurst size={tone === 'champion' ? 190 : 150} fill={tone === 'champion' ? 'var(--neon-gold)' : 'var(--neon-magenta)'} />
          </m.span>
          <m.span
            className="p5-result-star p5-result-star-a"
            initial={{ scale: 0, rotate: 30 }}
            animate={{ scale: 1, rotate: 12 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.3 }}
          >
            <StarBurst size={54} fill="#fff" stroke="#000" />
          </m.span>
          <m.span
            className="p5-result-star p5-result-star-b"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.4 }}
          >
            <StarBurst size={38} />
          </m.span>
        </>
      ) : (
        <m.span
          className="p5-result-slab"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.32, ease: [0.2, 0.9, 0.3, 1] }}
        />
      )}
    </div>
  );
}

/**
 * Titolo della schermata finale. Vittoria: lettere a ritaglio che piombano sullo schermo.
 * Sconfitta e pareggio: una riga sobria che scivola dentro, senza festa.
 */
export function FinalTitle({ tone, text }) {
  if (tone === 'win' || tone === 'champion') {
    return (
      <m.div
        className="battle-final-slam"
        initial={{ scale: 2.2, rotate: -14, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 24, delay: 0.1 }}
      >
        <PhantomTitle text={text} className={`battle-final-title is-${tone}`} />
      </m.div>
    );
  }
  return (
    <m.h2
      className={`battle-final-title is-${tone}`}
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
    >
      {text}
    </m.h2>
  );
}
