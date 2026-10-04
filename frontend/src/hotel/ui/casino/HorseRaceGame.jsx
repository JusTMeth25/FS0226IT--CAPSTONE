import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAmount } from './casinoUtils.js';
import { casinoSound } from './casinoSounds.js';
import { horseBus } from './horseBus.js';

/**
 * Ippodromo del casino: otto cavalli, una corsa per tutto il server a ciclo continuo.
 * Durante le puntate si sceglie la scommessa sulla schedina (vincente, piazzato, accoppiata,
 * trio), la posta e si punta; poi la corsa si vede in diretta con la cronaca, e all'arrivo le
 * vincite arrivano subito fra le fiches. Ordine d'arrivo e tempi li decide il server
 * (HorseRace): qui si disegna soltanto.
 */

const TYPES = [
  { id: 'WIN', label: 'Vincente', n: 1, help: 'il cavallo arriva primo' },
  { id: 'PLACE', label: 'Piazzato', n: 1, help: 'arriva fra i primi tre' },
  { id: 'EXACTA', label: 'Accoppiata', n: 2, help: 'primo e secondo, in ordine' },
  { id: 'TRIFECTA', label: 'Trio', n: 3, help: 'primo, secondo e terzo, in ordine' }
];
const STAKES = [5, 10, 25, 50, 100, 250, 500];
const ERRORS = {
  horse_not_betting: 'Le puntate sono chiuse: aspetta la prossima corsa.',
  horse_bad_bet: 'Scommessa non valida: controlla i cavalli scelti.',
  horse_bad_stake: 'La posta va da 5 a 500 fiches.',
  horse_too_many: 'Al massimo 12 scommesse a corsa.',
  casino_not_enough_chips: 'Non hai abbastanza fiches: passa dalla cassa.',
  casino_not_here: 'Si gioca solo dentro il Casinò.'
};
const PLACES = ['1°', '2°', '3°'];

const seconds = (ms) => Math.max(0, Math.ceil(ms / 1000));
const fmtOdds = (q) => q.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Quota come la calcola il server (HorseRace.oddsOf): margine diviso la probabilita' di Plackett-Luce. */
function oddsFor(type, picks, byNumber, margin) {
  const p = (n) => byNumber.get(n)?.p || 0;
  let prob;
  if (type === 'WIN') prob = p(picks[0]);
  else if (type === 'PLACE') return byNumber.get(picks[0])?.place;
  else if (type === 'EXACTA') prob = (p(picks[0]) * p(picks[1])) / (1 - p(picks[0]));
  else prob = ((p(picks[0]) * p(picks[1])) / (1 - p(picks[0]))) * (p(picks[2]) / (1 - p(picks[0]) - p(picks[1])));
  if (!prob) return null;
  return Math.max(1.01, Math.min(999, Math.floor((margin / prob) * 100) / 100));
}

/** Distanza percorsa (0..1) da un cavallo dopo `t` ms, dai suoi passaggi a 1/4, 1/2 e 3/4 del tempo. */
function progressAt(horse, t) {
  const F = horse.finishMs;
  if (!F || t <= 0) return 0;
  if (t >= F) return 1 + Math.min(0.04, (t - F) / 25_000);
  const pts = [[0, 0], [F / 4, horse.splits[0]], [F / 2, horse.splits[1]], [(3 * F) / 4, horse.splits[2]], [F, 1]];
  for (let i = 1; i < pts.length; i += 1) {
    if (t <= pts[i][0]) {
      const [t0, d0] = pts[i - 1];
      const [t1, d1] = pts[i];
      const k = (t - t0) / (t1 - t0);
      // Partenza dai blocchi: nel primo tratto si accelera.
      const eased = i === 1 ? k * k * (2 - k) : k;
      return d0 + (d1 - d0) * eased;
    }
  }
  return 1;
}

const COATS = ['#7c4a24', '#5b3a1e', '#a0642c', '#3b2414', '#8b5a2b', '#2b1d12', '#b07a45', '#6b4423'];

/** Cavallo al galoppo col fantino nei colori della scuderia (casacca e berretto). */
function Runner({ horse }) {
  const coat = COATS[(horse.number - 1) % COATS.length];
  return (
    <svg className="horse-svg" viewBox="0 0 48 32" aria-hidden="true">
      <path d="M11 14 Q4 11 2 19 Q6 16 10 17Z" fill="#1f130a" />
      <g className="horse-legs back" stroke={coat} strokeWidth="2.6" strokeLinecap="round">
        <line x1="14" y1="19" x2="9" y2="28" /><line x1="18" y1="20" x2="21" y2="29" />
      </g>
      <g className="horse-legs front" stroke={coat} strokeWidth="2.6" strokeLinecap="round">
        <line x1="29" y1="19" x2="34" y2="28" /><line x1="32" y1="18" x2="38" y2="25" />
      </g>
      <ellipse cx="22" cy="16" rx="12" ry="6" fill={coat} />
      <path d="M29 13 L37 5 L41 7 L35 18Z" fill={coat} />
      <path d="M37 4 L46 8 L45 11.5 L39 10.5Z" fill={coat} />
      <path d="M33 9 L37 4 L36 9Z" fill="#1f130a" />
      <circle cx="43.5" cy="8.5" r="0.9" fill="#fff" />
      <path d="M20 11 Q24 3 30 6 L28 12Z" fill={horse.silk} stroke="#000" strokeWidth="0.6" />
      <circle cx="27" cy="3.3" r="2.6" fill={horse.silk} stroke="#000" strokeWidth="0.6" />
      <line x1="27" y1="8" x2="36" y2="8" stroke="#f5d0a9" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="18" y="13" width="7" height="5" rx="1" fill="#fff" />
      <text x="21.5" y="17.2" fontSize="4.6" fontWeight="800" textAnchor="middle" fill="#111" fontFamily="system-ui, sans-serif">{horse.number}</text>
    </svg>
  );
}

function Silk({ horse, small }) {
  return <span className={`horse-silk${small ? ' small' : ''}`} style={{ '--silk': horse.silk }}>{horse.number}</span>;
}

export default function HorseRaceGame({ ctx, wallet, send }) {
  const [race, setRace] = useState(() => horseBus.last());
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [type, setType] = useState('WIN');
  const [picks, setPicks] = useState([]);
  const [stake, setStake] = useState(10);
  const [now, setNow] = useState(() => Date.now());
  const [call, setCall] = useState('');
  const runners = useRef(new Map());
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; });

  useEffect(() => {
    send({ type: 'horse_watch' });
    return horseBus.subscribe((event) => {
      const c = ctxRef.current;
      if (event.type === 'state') {
        setRace(event.race);
        setReceivedAt(Date.now());
      }
      if (event.type === 'win') {
        c.refresh();
        casinoSound.win(event.chips >= 200);
        c.setMessage({ tone: 'win', text: `${event.bet}: hai vinto ${formatAmount(event.chips)} fiches!` });
      }
      if (event.type === 'error') {
        c.refresh();
        c.setMessage({ tone: 'lose', text: ERRORS[event.code] || 'Puntata non valida.' });
      }
    });
  }, [send]);

  // Conto alla rovescia fra un messaggio e l'altro.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Nuova corsa: la schedina riparte vuota.
  const round = race?.round;
  const [slipRound, setSlipRound] = useState(round);
  if (round !== slipRound) {
    setSlipRound(round);
    setPicks([]);
  }

  // Corsa in diretta: posizioni aggiornate a ogni fotogramma (senza ridisegnare React), cronaca e suoni.
  const phase = race?.phase;
  useEffect(() => {
    if (!race || phase === 'betting') return undefined;
    let raf = 0;
    let leader = null;
    let lastGallop = 0;
    let lastCall = 0;
    let started = false;
    const finishLine = Math.min(...race.horses.map((h) => h.finishMs || Infinity));
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = (race.elapsed || 0) + (Date.now() - receivedAt);
      race.horses.forEach((h) => {
        const el = runners.current.get(h.number);
        if (el) el.style.setProperty('--p', Math.min(1.04, progressAt(h, t)).toFixed(4));
      });
      if (phase !== 'racing') return;
      if (!started && t < 1500) {
        started = true;
        casinoSound.bugle();
      }
      if (t - lastGallop > 1000 && t < finishLine + 2500) {
        lastGallop = t;
        casinoSound.gallop(t > finishLine * 0.75 ? 1.4 : 1);
      }
      if (t - lastCall > 1200) {
        lastCall = t;
        const ranked = [...race.horses].sort((a, b) => progressAt(b, t) - progressAt(a, t));
        const first = ranked[0];
        if (t > finishLine) {
          setCall(`Taglia il traguardo per primo ${first.name}!`);
        } else if (leader !== first.number) {
          leader = first.number;
          setCall(t < 2500 ? `Partiti! Scatta meglio ${first.name}` : `Passa in testa ${first.name}, il numero ${first.number}!`);
        } else if (t > finishLine * 0.72) {
          setCall(`Dirittura d'arrivo: ${first.name} davanti, ${ranked[1].name} rimonta!`);
        } else {
          setCall(`${first.name} conduce, poi ${ranked[1].name} e ${ranked[2].name}`);
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [race, phase, receivedAt]);

  // Arrivo: il pubblico esulta. Durante le puntate i cavalli tornano ai blocchi di partenza.
  const cheered = useRef(null);
  useEffect(() => {
    if (phase === 'result' && cheered.current !== round) {
      cheered.current = round;
      casinoSound.crowd();
    }
    if (phase === 'betting') runners.current.forEach((el) => el.style.setProperty('--p', '0'));
  }, [phase, round]);

  const byNumber = useMemo(() => new Map((race?.horses || []).map((h) => [h.number, h])), [race]);
  if (!race || !race.horses?.length) return <p className="holdem-loading">I cavalli entrano in pista…</p>;

  const left = Math.max(0, race.left - Math.max(0, now - receivedAt));
  const betting = phase === 'betting';
  const chosen = TYPES.find((tp) => tp.id === type);
  const ready = picks.length === chosen.n;
  const odds = ready ? oddsFor(type, picks, byNumber, race.margin) : null;
  const chips = wallet?.chips ?? 0;
  const myBets = race.myBets || [];

  const pick = (n) => {
    if (!betting) return;
    casinoSound.chip();
    setPicks((cur) => {
      if (cur.includes(n)) return cur.filter((x) => x !== n);
      if (chosen.n === 1) return [n];
      return cur.length >= chosen.n ? [...cur.slice(1), n] : [...cur, n];
    });
  };
  const quick = (n, tp) => {
    if (!betting) return;
    casinoSound.chip();
    setType(tp);
    setPicks([n]);
  };
  const place = () => {
    if (!ready) return;
    casinoSound.chipStack(4);
    send({ type: 'horse_bet', bet: type, horses: picks, stake });
    setPicks([]);
  };

  const status = {
    betting: `Puntate aperte: partenza fra ${seconds(left)} s`,
    racing: call || 'Partiti!',
    result: `Arrivo: ${race.order?.slice(0, 3).map((n, i) => `${PLACES[i]} ${byNumber.get(n)?.name}`).join(' · ')} — prossima corsa fra ${seconds(left)} s`
  }[phase];

  return (
    <div className="casino-horse">
      <div className={`horse-track ${phase}`} aria-label="Pista dell'ippodromo">
        <div className="horse-finish" aria-hidden="true" />
        {race.horses.map((h) => {
          const pos = race.order ? race.order.indexOf(h.number) : -1;
          return (
            <div key={h.number} className={`horse-lane${picks.includes(h.number) ? ' picked' : ''}`}>
              <div className="horse-runner" ref={(el) => { if (el) runners.current.set(h.number, el); else runners.current.delete(h.number); }}>
                <Runner horse={h} />
              </div>
              {phase === 'result' && pos >= 0 && <span className={`horse-pos p${pos + 1}`}>{pos + 1}°</span>}
            </div>
          );
        })}
      </div>
      <p className={`horse-status ${phase}`} role="status">{status}</p>

      <div className="horse-main">
        <div className="horse-field">
          <div className="horse-field-head"><span>Cavallo</span><span>Forma</span><span>Vincente</span><span>Piazzato</span></div>
          {race.horses.map((h) => (
            <div key={h.number} className={`horse-row${picks.includes(h.number) ? ' picked' : ''}`}>
              <button type="button" className="horse-name" onClick={() => pick(h.number)} disabled={!betting} aria-pressed={picks.includes(h.number)}>
                <Silk horse={h} />
                <span>{h.name}</span>
                {picks.includes(h.number) && chosen.n > 1 && <b className="horse-order">{PLACES[picks.indexOf(h.number)]}</b>}
              </button>
              <span className={`horse-form ${h.form > 2 ? 'up' : h.form < -2 ? 'down' : ''}`} title={`Valutazione ${h.rating}, forma ${h.form > 0 ? '+' : ''}${h.form}`}>
                {'★'.repeat(Math.max(1, Math.round((h.rating - 65) / 6)))}{h.form > 2 ? ' ▲' : h.form < -2 ? ' ▼' : ''}
              </span>
              <button type="button" className="horse-odds" onClick={() => quick(h.number, 'WIN')} disabled={!betting}>{fmtOdds(h.win)}</button>
              <button type="button" className="horse-odds" onClick={() => quick(h.number, 'PLACE')} disabled={!betting}>{fmtOdds(h.place)}</button>
            </div>
          ))}
        </div>

        <div className="horse-side">
          <div className="horse-slip">
            <h4>Schedina</h4>
            <div className="horse-types" role="radiogroup" aria-label="Tipo di scommessa">
              {TYPES.map((tp) => (
                <button key={tp.id} type="button" className={type === tp.id ? 'active' : ''} aria-pressed={type === tp.id} disabled={!betting}
                  onClick={() => { setType(tp.id); setPicks((cur) => cur.slice(0, tp.n)); }} title={tp.help}>{tp.label}</button>
              ))}
            </div>
            <p className="horse-slip-help">{chosen.label}: {chosen.help}. {chosen.n > 1 ? `Tocca ${chosen.n} cavalli nell'ordine d'arrivo.` : 'Tocca un cavallo o la sua quota.'}</p>
            <div className="horse-picks">
              {Array.from({ length: chosen.n }, (_, i) => {
                const h = byNumber.get(picks[i]);
                return <span key={i} className="horse-pick">{chosen.n > 1 && <small>{PLACES[i]}</small>}{h ? <><Silk horse={h} small /> {h.name}</> : '—'}</span>;
              })}
            </div>
            <div className="horse-stakes" role="radiogroup" aria-label="Posta">
              {STAKES.map((s) => (
                <button key={s} type="button" className={stake === s ? 'active' : ''} aria-pressed={stake === s} onClick={() => setStake(s)} disabled={!betting}>{s}</button>
              ))}
            </div>
            <div className="horse-slip-total">
              <span>Quota <b>{odds ? fmtOdds(odds) : '—'}</b></span>
              <span>Vincita possibile <b>{odds ? formatAmount(Math.floor(stake * odds)) : '—'}</b></span>
            </div>
            <button type="button" className="casino-big-btn gold" onClick={place} disabled={!betting || !ready || chips < stake || myBets.length >= race.maxBets}>
              {betting ? `PUNTA ${formatAmount(stake)}` : 'PUNTATE CHIUSE'}
            </button>
          </div>

          <div className="horse-mine">
            <h4>Le tue scommesse {race.myStaked ? <small>· puntati {formatAmount(race.myStaked)}{race.myWon ? ` · vinti ${formatAmount(race.myWon)}` : ''}</small> : null}</h4>
            {myBets.length === 0 ? <p className="horse-empty">Nessuna scommessa su questa corsa.</p> : (
              <ul>
                {myBets.map((b, i) => (
                  <li key={i} className={b.paid === undefined ? '' : b.paid > 0 ? 'won' : 'lost'}>
                    <span>{b.label} {b.horses.map((n) => byNumber.get(n)?.name || n).join(' - ')}</span>
                    <span>{formatAmount(b.stake)} @ {fmtOdds(b.odds)}</span>
                    <b>{b.paid === undefined ? 'in corsa' : b.paid > 0 ? `+${formatAmount(b.paid)}` : 'persa'}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="horse-feed">
            <h4>Ultime puntate in sala</h4>
            <ul>
              {(race.feed || []).slice(0, 6).map((f, i) => <li key={i}><b>{f.name}</b> {f.bet} · {formatAmount(f.stake)}</li>)}
            </ul>
            {race.history?.length > 0 && (
              <p className="horse-history">Ultimi vincitori: {race.history.map((h) => (
                <span key={h.round} title={`quota ${fmtOdds(h.odds)}`}><i style={{ background: h.silk }} />{h.name}</span>
              ))}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
