import { useEffect, useRef, useState } from 'react';
import { soundService } from '../../../services/soundService.js';
import { formatAmount } from './casinoUtils.js';
import { casinoSound } from './casinoSounds.js';
import { bingoBus } from './bingoBus.js';
import { SMORFIA, callLine } from './smorfia.js';

/**
 * Banco del Bingo a 90 numeri: il tabellone con i numeri usciti, la pallina appena estratta con
 * la smorfia napoletana (e il banditore che la legge ad alta voce), i premi in palio, il jackpot e
 * le proprie cartelle. Tutto lo decide il server (BingoGame); qui si comprano le cartelle e si
 * segnano i numeri, da soli o a mano.
 */

const ERRORS = {
  bingo_not_selling: 'Le cartelle si comprano prima dell\'estrazione: aspetta la prossima partita.',
  bingo_too_many: 'Al massimo 6 cartelle a partita.',
  casino_not_enough_chips: 'Non hai abbastanza fiches: passa dalla cassa.',
  casino_not_here: 'Si gioca solo dentro il Casinò.'
};
const PRIZES = [['LINE', 'Linea', 'una riga completa'], ['TWO_LINES', 'Doppia linea', 'due righe'], ['BINGO', 'Bingo', 'tutta la cartella']];
const VOICE_KEY = 'vinyldex_bingo_voice';
const AUTO_KEY = 'vinyldex_bingo_auto';

function readFlag(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function saveFlag(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Vale finche' resta aperta la pagina.
  }
}

/** Il banditore legge il numero con la sintesi vocale del browser (italiano), se c'e'. */
function speak(text, { queue = false } = {}) {
  if (!soundService.isEnabled() || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    const voice = synth.getVoices().find((v) => v.lang?.startsWith('it'));
    if (voice) u.voice = voice;
    // Safari a volte resta in pausa (dopo uno sfondo o una chiamata): si riprende.
    if (synth.paused) synth.resume();
    // Le palline si interrompono a vicenda; l'annuncio di un premio aspetta la fine del numero.
    // Su iPhone una frase detta subito dopo cancel() si perde: si aspetta un attimo.
    if (!queue && (synth.speaking || synth.pending)) {
      synth.cancel();
      setTimeout(() => synth.speak(u), 80);
    } else {
      synth.speak(u);
    }
  } catch {
    // Sintesi vocale non disponibile: resta il testo.
  }
}

const seconds = (ms) => Math.max(0, Math.ceil(ms / 1000));

function BingoCard({ card, drawn, auto, marks, onMark, index }) {
  return (
    <div className={`bingo-card${card.lines === 3 ? ' full' : ''}`}>
      <div className="bingo-card-head">
        <span>Cartella {index + 1}</span>
        {card.missing === 1 && <b className="bingo-one">Manca 1!</b>}
        {card.missing > 1 && <small>mancano {card.missing}</small>}
      </div>
      <div className="bingo-grid">
        {card.rows.map((row, r) => row.map((n, c) => {
          if (!n) return <span key={`${r}-${c}`} className="bingo-cell empty" />;
          const out = drawn.has(n);
          const marked = auto ? out : marks.has(n);
          return (
            <button key={`${r}-${c}`} type="button" className={`bingo-cell${marked ? ' marked' : ''}${out && !marked ? ' due' : ''}`}
              onClick={() => onMark(n)} disabled={auto} aria-pressed={marked} aria-label={`Numero ${n}${marked ? ', segnato' : ''}`}>
              {n}
            </button>
          );
        }))}
      </div>
    </div>
  );
}

export default function BingoGame({ ctx, wallet, send }) {
  const [bingo, setBingo] = useState(() => bingoBus.last());
  const [count, setCount] = useState(2);
  const [voice, setVoice] = useState(() => readFlag(VOICE_KEY, true));
  const [auto, setAuto] = useState(() => readFlag(AUTO_KEY, true));
  // Numeri segnati a mano, per partita (una partita nuova riparte da zero).
  const [marksState, setMarksState] = useState({ round: -1, set: new Set() });
  const [, setTick] = useState(0);
  const prev = useRef(null);
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; });

  useEffect(() => {
    send({ type: 'bingo_watch' });
    return bingoBus.subscribe((event) => {
      const c = ctxRef.current;
      if (event.type === 'state') setBingo(event.bingo);
      if (event.type === 'win') {
        c.refresh();
        c.setMessage({ tone: 'win', text: `${event.prize}! Hai vinto ${formatAmount(event.chips)} fiches.` });
      }
      if (event.type === 'error') c.setMessage({ tone: 'lose', text: ERRORS[event.code] || 'Mossa non valida.' });
    });
  }, [send]);

  // Il conto alla rovescia scorre anche fra un messaggio e l'altro.
  const [sinceUpdate, setSinceUpdate] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => { setSinceUpdate(Date.now() - started); setTick((t) => t + 1); }, 500);
    return () => clearInterval(id);
  }, [bingo]);

  // Pallina nuova: suono, voce del banditore; premio vinto da qualcuno: fanfara.
  useEffect(() => {
    const before = prev.current;
    prev.current = bingo;
    if (!bingo || !before) return;
    if (bingo.last && bingo.last !== before.last && bingo.drawn.length > before.drawn.length) {
      casinoSound.chip();
      casinoSound.bell();
      if (voice) speak(callLine(bingo.last));
    }
    // Il bingo chiude la partita: lo stato arriva gia' "ended", quindi vale anche il passaggio
    // da "calling" a "ended". Con piu' premi alla stessa pallina si annunciano tutti.
    const fresh = (bingo.winners || []).slice(before.round === bingo.round ? (before.winners?.length || 0) : 0);
    if (fresh.length && (bingo.phase === 'calling' || before.phase === 'calling')) {
      const big = fresh.some((w) => w.prize === 'BINGO');
      casinoSound.win(big);
      if (voice) fresh.forEach((w) => speak(`${w.label}! ${w.names.join(', ')}`, { queue: true }));
    }
  }, [bingo, voice]);

  if (!bingo) return <p className="holdem-loading">Il banditore prepara le palline…</p>;

  const drawn = new Set(bingo.drawn);
  // Annuncio grande del premio appena vinto: resta fino alla pallina dopo (il bingo fino a fine partita).
  const lastWin = bingo.winners?.[bingo.winners.length - 1];
  const shout = lastWin && lastWin.ball === bingo.drawn.length && bingo.phase !== 'idle' ? lastWin : null;
  const marks = marksState.round === bingo.round ? marksState.set : new Set();
  const left = Math.max(0, bingo.left - sinceUpdate);
  const myCards = bingo.myCards || [];
  const selling = bingo.phase === 'idle' || bingo.phase === 'sale';
  const room = Math.max(0, bingo.maxCards - myCards.length);
  const chips = wallet?.chips ?? 0;
  const buy = () => {
    casinoSound.chipStack(3);
    send({ type: 'bingo_buy', count: Math.min(count, room) });
  };
  const mark = (n) => {
    casinoSound.chip();
    const copy = new Set(marks);
    if (copy.has(n)) copy.delete(n);
    else copy.add(n);
    setMarksState({ round: bingo.round, set: copy });
  };
  const status = {
    idle: 'Compra una cartella per far partire la prossima partita.',
    sale: `Vendita delle cartelle: l'estrazione comincia fra ${seconds(left)} s.`,
    calling: `Estrazione in corso: ${bingo.drawn.length} numeri usciti${bingo.oneAway ? ` · ${bingo.oneAway} cartelle a un numero dalla ${PRIZES.find(([k]) => k === bingo.next)?.[1].toLowerCase() || 'vincita'}!` : ''}`,
    ended: `Partita finita: la prossima vendita fra ${seconds(left)} s.`
  }[bingo.phase];

  return (
    <div className="casino-bingo">
      {shout && (
        <div key={`${bingo.round}-${bingo.winners.length}`} className={`bingo-shout${shout.prize === 'BINGO' ? ' big' : ''}`} role="status">
          <b>{shout.label}!</b>
          <span>{shout.names.join(', ')} · {formatAmount(shout.amount)} fiches</span>
        </div>
      )}
      <div className="bingo-top">
        <div className="bingo-ball-zone">
          <div className={`bingo-cage${bingo.phase === 'calling' ? ' spinning' : ''}`} aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
          </div>
          <div className="bingo-ball" key={bingo.last || 'none'}>
            {bingo.last ? <><b>{bingo.last}</b><small>{SMORFIA[bingo.last]}</small></> : <small>?</small>}
          </div>
        </div>
        <div className="bingo-prizes">
          {PRIZES.map(([key, label, what]) => {
            const won = bingo.winners?.find((w) => w.prize === key);
            return (
              <div key={key} className={`bingo-prize${bingo.next === key && bingo.phase === 'calling' ? ' live' : ''}${won ? ' won' : ''}`}>
                <span>{label} <small>({what})</small></span>
                <b>{formatAmount(won ? won.amount : bingo.prizes?.[key] || 0)}</b>
                {won && <small className="bingo-who">{won.names.join(', ')} al {won.ball}° numero{won.jackpot ? ` + jackpot ${formatAmount(won.jackpot)}!` : ''}</small>}
              </div>
            );
          })}
          <div className="bingo-prize jackpot">
            <span>Jackpot <small>(bingo entro {bingo.jackpotCalls} numeri)</small></span>
            <b>{formatAmount(bingo.jackpot)}</b>
          </div>
          <small className="bingo-sold">{bingo.tickets} cartelle in gioco · {bingo.players} giocatori · montepremi {formatAmount(bingo.pot)}</small>
        </div>
      </div>

      <p className="bingo-status">{status}</p>

      <div className="bingo-board" aria-label="Tabellone dei numeri usciti">
        {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
          <span key={n} className={`bingo-board-n${drawn.has(n) ? ' out' : ''}${n === bingo.last ? ' last' : ''}`} title={SMORFIA[n]}>{n}</span>
        ))}
      </div>

      <div className="bingo-controls">
        {selling && room > 0 ? (
          <div className="bingo-buy">
            <span>Cartelle da {bingo.price} fiches:</span>
            {[1, 2, 3, 4, 5, 6].filter((n) => n <= room).map((n) => (
              <button key={n} type="button" className={count === n ? 'active' : ''} onClick={() => setCount(n)} aria-pressed={count === n}>{n}</button>
            ))}
            <button type="button" className="casino-big-btn gold" onClick={buy} disabled={chips < Math.min(count, room) * bingo.price}>
              COMPRA ({formatAmount(Math.min(count, room) * bingo.price)})
            </button>
          </div>
        ) : (
          <span className="bingo-mine">{myCards.length ? `Hai ${myCards.length} cartelle in gioco${bingo.myWon ? ` · vinti ${formatAmount(bingo.myWon)}` : ''}` : 'Nessuna cartella in questa partita: la prossima vendita apre a fine estrazione.'}</span>
        )}
        <label className="bingo-toggle"><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); saveFlag(AUTO_KEY, e.target.checked); }} /> Segna da solo</label>
        <label className="bingo-toggle"><input type="checkbox" checked={voice} onChange={(e) => { setVoice(e.target.checked); saveFlag(VOICE_KEY, e.target.checked); }} /> Voce del banditore</label>
      </div>

      {myCards.length > 0 && (
        <div className="bingo-cards">
          {myCards.map((card, i) => <BingoCard key={i} index={i} card={card} drawn={drawn} auto={auto} marks={marks} onMark={mark} />)}
        </div>
      )}
    </div>
  );
}
