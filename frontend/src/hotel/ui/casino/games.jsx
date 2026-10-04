import { useRef, useState } from 'react';
import { casinoApi } from '../../../services/casinoApi.js';
import { Chip, Die, PlayingCard } from './casinoParts.jsx';
import { formatAmount } from './casinoUtils.js';
import { casinoSound } from './casinoSounds.js';

/**
 * I tavoli del casino. Ogni gioco chiede il giro al server (che decide tutto e muove i saldi) e
 * poi lo racconta con le animazioni: rulli che girano, ruota della roulette, carte distribuite,
 * dadi lanciati. `ctx` arriva da CasinoPanel: valuta scelta, fiche scelta, saldi e messaggi.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Puntata fatta di fiches impilate in un cerchio: si aggiungono con la fiche scelta. */
function BetCircle({ bet, onAdd, onClear, label = 'Puntata', disabled }) {
  const stack = [];
  let rest = bet;
  for (const value of [1000, 500, 100, 25, 5, 1]) {
    while (rest >= value && stack.length < 8) {
      stack.push(value);
      rest -= value;
    }
  }
  return (
    <div className="casino-bet">
      <button type="button" className="casino-bet-circle" onClick={() => { casinoSound.chip(); onAdd(); }} disabled={disabled} aria-label={`${label}: aggiungi la fiche scelta`}>
        {stack.length === 0 && <span className="casino-bet-hint">{label}</span>}
        {stack.map((v, i) => (
          <span key={i} className="casino-bet-stack" style={{ transform: `translateY(${-i * 4}px)` }}><Chip value={v} size={46} /></span>
        ))}
      </button>
      <div className="casino-bet-amount">{formatAmount(bet)}</div>
      {bet > 0 && !disabled && <button type="button" className="casino-link" onClick={onClear}>Azzera</button>}
    </div>
  );
}

// ------------------------------------------------------------------ slot

const SYMBOLS = ['CHERRY', 'LEMON', 'ORANGE', 'PLUM', 'BELL', 'BAR', 'SEVEN', 'VINYL'];
const PAYS = [['VINYL', 500], ['SEVEN', 150], ['BAR', 80], ['BELL', 40], ['PLUM', 25], ['ORANGE', 18], ['CHERRY', 15], ['LEMON', 12]];

function SlotSymbol({ name }) {
  switch (name) {
    case 'CHERRY': return <span className="slot-sym" aria-label="Ciliegia">🍒</span>;
    case 'LEMON': return <span className="slot-sym" aria-label="Limone">🍋</span>;
    case 'ORANGE': return <span className="slot-sym" aria-label="Arancia">🍊</span>;
    case 'PLUM': return <span className="slot-sym" aria-label="Uva">🍇</span>;
    case 'BELL': return <span className="slot-sym" aria-label="Campana">🔔</span>;
    case 'BAR': return <span className="slot-sym slot-bar" aria-label="Bar">BAR</span>;
    case 'SEVEN': return <span className="slot-sym slot-seven" aria-label="Sette">7</span>;
    default:
      return (
        <span className="slot-sym" aria-label="Vinile">
          <svg viewBox="0 0 40 40" width="1em" height="1em"><circle cx="20" cy="20" r="19" fill="#111018" /><circle cx="20" cy="20" r="13" fill="none" stroke="#2c2c35" strokeWidth="1.5" /><circle cx="20" cy="20" r="7" fill="#d4a537" /><circle cx="20" cy="20" r="1.8" fill="#111018" /></svg>
        </span>
      );
  }
}

export function SlotGame({ ctx }) {
  const [reels, setReels] = useState([['SEVEN', 'BAR', 'BELL'], ['VINYL', 'SEVEN', 'CHERRY'], ['BELL', 'BAR', 'SEVEN']]);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [win, setWin] = useState(null);
  const bet = ctx.chip;

  async function spin() {
    if (spinning.some(Boolean)) return;
    setWin(null);
    ctx.setMessage(null);
    setSpinning([true, true, true]);
    casinoSound.slotSpin(1.6);
    try {
      const res = await casinoApi.slot(bet, ctx.currency);
      // I rulli si fermano uno alla volta, da sinistra.
      for (let r = 0; r < 3; r += 1) {
        await sleep(r === 0 ? 700 : 450);
        setReels((prev) => prev.map((reel, i) => (i === r ? res.reels[r] : reel)));
        setSpinning((prev) => prev.map((s, i) => (i === r ? false : s)));
        casinoSound.reelStop(r);
      }
      if (res.multiplier >= 80) casinoSound.jackpot();
      else if (res.multiplier > 1) casinoSound.coins(res.multiplier);
      setWin(res.multiplier > 0 ? res : null);
      ctx.done(res, res.win ? `${res.win}: x${res.multiplier}` : null);
    } catch (err) {
      setSpinning([false, false, false]);
      ctx.fail(err);
    }
  }

  return (
    <div className="casino-slot">
      <div className="slot-cabinet">
        <div className="slot-title">VINYL <b>7</b> SLOT</div>
        <div className="slot-window">
          {reels.map((reel, r) => (
            <div key={r} className={`slot-reel${spinning[r] ? ' spinning' : ''}`}>
              {(spinning[r] ? [...SYMBOLS, ...SYMBOLS] : reel).map((s, i) => <SlotSymbol key={i} name={s} />)}
            </div>
          ))}
          <div className={`slot-payline${win ? ' lit' : ''}`} />
        </div>
        <div className="slot-controls">
          <span className="slot-bet">Puntata <b>{formatAmount(bet)}</b></span>
          <button type="button" className="casino-big-btn" onClick={spin} disabled={spinning.some(Boolean)}>GIRA</button>
        </div>
      </div>
      <table className="casino-paytable">
        <caption>Tabella dei premi (per 1 puntato, sulla linea centrale)</caption>
        <tbody>
          {PAYS.map(([s, x]) => (
            <tr key={s} className={win?.line?.every((l) => l === s) ? 'hit' : ''}><td><SlotSymbol name={s} /><SlotSymbol name={s} /><SlotSymbol name={s} /></td><td>x{x}</td></tr>
          ))}
          <tr><td>BAR e 7 misti</td><td>x20</td></tr>
          <tr><td><SlotSymbol name="CHERRY" /><SlotSymbol name="CHERRY" /> due ciliegie</td><td>x2</td></tr>
          <tr><td><SlotSymbol name="CHERRY" /> sul primo rullo</td><td>x1</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ roulette

const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const numberColor = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');

function RouletteWheel({ rotation, spinning, result }) {
  const step = 360 / 37;
  return (
    <div className="roulette-wheel-wrap">
      <div className="roulette-pointer" />
      <svg className={`roulette-wheel${spinning ? ' spinning' : ''}`} viewBox="-110 -110 220 220" style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
        <circle r="108" fill="#4a2511" />
        <circle r="100" fill="#2a140c" />
        {WHEEL.map((n, i) => {
          const a0 = ((i - 0.5) * step - 90) * (Math.PI / 180);
          const a1 = ((i + 0.5) * step - 90) * (Math.PI / 180);
          const p = (r, a) => `${Math.cos(a) * r} ${Math.sin(a) * r}`;
          const fill = n === 0 ? '#15803d' : RED.has(n) ? '#b91c1c' : '#111018';
          const mid = (i * step - 90) * (Math.PI / 180);
          return (
            <g key={n}>
              <path d={`M ${p(96, a0)} A 96 96 0 0 1 ${p(96, a1)} L ${p(66, a1)} A 66 66 0 0 0 ${p(66, a0)} Z`} fill={fill} stroke="#d4a537" strokeWidth="0.6" />
              <text x={Math.cos(mid) * 84} y={Math.sin(mid) * 84} fill="#fff" fontSize="8" fontWeight="700" textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${i * step} ${Math.cos(mid) * 84} ${Math.sin(mid) * 84})`}>{n}</text>
            </g>
          );
        })}
        <circle r="64" fill="#7a4a24" stroke="#d4a537" strokeWidth="2" />
        <circle r="44" fill="#9a6232" />
        {[0, 90, 180, 270].map((a) => <rect key={a} x="-3" y="-40" width="6" height="40" fill="#d4a537" transform={`rotate(${a})`} />)}
        <circle r="10" fill="#d4a537" stroke="#fde68a" strokeWidth="2" />
      </svg>
      {result != null && !spinning && <div className={`roulette-result ${numberColor(result)}`}>{result}</div>}
    </div>
  );
}

const OUTSIDE = [['low', '1-18'], ['even', 'PARI'], ['red', '◆'], ['black', '◆'], ['odd', 'DISPARI'], ['high', '19-36']];

export function RouletteGame({ ctx }) {
  const [bets, setBets] = useState({});
  const [lastBets, setLastBets] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const total = Object.values(bets).reduce((a, b) => a + b, 0);

  const place = (key) => {
    if (spinning) return;
    if (total + ctx.chip > 2000) {
      ctx.setMessage({ tone: 'lose', text: 'Massimo 2.000 per giro.' });
      return;
    }
    setResult(null);
    casinoSound.chip();
    setBets((b) => ({ ...b, [key]: (b[key] || 0) + ctx.chip }));
  };

  async function spin() {
    if (!total || spinning) return;
    ctx.setMessage(null);
    setSpinning(true);
    try {
      const res = await casinoApi.roulette(Object.entries(bets).map(([bet, stake]) => ({ bet, stake })), ctx.currency);
      // La ruota fa cinque giri e si ferma con il numero uscito sotto la pallina, in alto.
      const index = WHEEL.indexOf(res.number);
      const target = 360 * 5 + (360 - index * (360 / 37));
      setRotation((r) => r - (r % 360) + target);
      casinoSound.rouletteSpin(4.2);
      await sleep(4200);
      casinoSound.bell();
      setSpinning(false);
      setResult(res.number);
      setLastBets(bets);
      setBets({});
      ctx.done(res, `Esce il ${res.number} ${res.color === 'red' ? 'rosso' : res.color === 'black' ? 'nero' : 'verde'}`);
    } catch (err) {
      setSpinning(false);
      ctx.fail(err);
    }
  }

  const cell = (key, label, cls = '') => (
    <button key={key} type="button" className={`roulette-cell ${cls}${result != null && winsOn(key, result) ? ' winner' : ''}`} onClick={() => place(key)} disabled={spinning}>
      <span>{label}</span>
      {bets[key] > 0 && <span className="roulette-chip"><Chip value={bets[key]} size={26} /></span>}
    </button>
  );

  return (
    <div className="casino-roulette">
      <RouletteWheel rotation={rotation} spinning={spinning} result={result} />
      <div className="roulette-board">
        <div className="roulette-zero">{cell('n:0', '0', 'green')}</div>
        <div className="roulette-numbers">
          {[3, 2, 1].map((row) => Array.from({ length: 12 }, (_, col) => {
            const n = col * 3 + row;
            return cell(`n:${n}`, n, numberColor(n));
          }))}
        </div>
        <div className="roulette-columns">{[3, 2, 1].map((c) => cell(`column:${c}`, '2:1', 'outside'))}</div>
        <div className="roulette-dozens">{[1, 2, 3].map((d) => cell(`dozen:${d}`, `${d}ª 12`, 'outside'))}</div>
        <div className="roulette-outside">{OUTSIDE.map(([key, label]) => cell(key, label, `outside ${key === 'red' ? 'red' : key === 'black' ? 'black' : ''}`))}</div>
      </div>
      <div className="casino-actions">
        <span>Puntato: <b>{formatAmount(total)}</b></span>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setBets({})} disabled={spinning || !total}>Cancella</button>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => lastBets && setBets(lastBets)} disabled={spinning || !lastBets}>Ripeti</button>
        <button type="button" className="casino-big-btn" onClick={spin} disabled={spinning || !total}>{spinning ? 'Rien ne va plus' : 'GIRA'}</button>
      </div>
    </div>
  );
}

function winsOn(key, n) {
  if (key.startsWith('n:')) return Number(key.slice(2)) === n;
  if (n === 0) return false;
  if (key.startsWith('dozen:')) return Math.floor((n - 1) / 12) + 1 === Number(key.slice(6));
  if (key.startsWith('column:')) return ((n - 1) % 3) + 1 === Number(key.slice(7));
  return { red: RED.has(n), black: !RED.has(n), even: n % 2 === 0, odd: n % 2 === 1, low: n <= 18, high: n >= 19 }[key] || false;
}

// ------------------------------------------------------------------ blackjack

export function BlackjackGame({ ctx, resume }) {
  const [bet, setBet] = useState(0);
  const [hand, setHand] = useState(resume || null);
  const [busy, setBusy] = useState(false);
  const playing = hand && !hand.done;

  async function act(call) {
    setBusy(true);
    ctx.setMessage(null);
    try {
      // Una "strisciata" per ogni carta nuova sul tavolo (mano nuova: si parte da zero).
      const visible = (h) => (h ? h.player.length + h.dealer.filter((c) => c !== '??').length : 0);
      const before = hand && !hand.done ? visible(hand) : 0;
      const res = await call();
      const fresh = Math.max(1, visible(res) - before);
      for (let i = 0; i < fresh; i += 1) casinoSound.deal(i * 0.15);
      if (res.done && res.dealer.length > 1) casinoSound.flip(fresh * 0.15);
      setHand(res);
      if (res.outcome === 'blackjack') casinoSound.blackjack();
      if (res.done) {
        const labels = { blackjack: 'Blackjack!', win: 'Vinci tu', push: 'Pareggio', lose: 'Vince il banco', bust: 'Sballato!' };
        ctx.done(res, labels[res.outcome]);
      } else {
        ctx.refresh();
      }
    } catch (err) {
      ctx.fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="casino-felt casino-blackjack">
      <div className="felt-arc">BLACKJACK PAGA 3 A 2 · IL BANCO STA SU 17</div>
      <div className="casino-hand">
        <span className="casino-hand-label">Banco {hand && <b>{hand.dealerValue}</b>}</span>
        <div className="casino-cards">{(hand?.dealer || []).map((c, i) => <PlayingCard key={`${i}-${c}`} code={c} delay={i * 150} />)}</div>
      </div>
      <div className="casino-hand">
        <span className="casino-hand-label">Tu {hand && <b>{hand.playerValue}</b>}</span>
        <div className="casino-cards">{(hand?.player || []).map((c, i) => <PlayingCard key={`${i}-${c}`} code={c} delay={i * 150} />)}</div>
      </div>
      {playing ? (
        <div className="casino-actions">
          <span>Puntata <b>{formatAmount(hand.stake)}</b></span>
          <button type="button" className="casino-big-btn" onClick={() => act(() => casinoApi.blackjack('hit'))} disabled={busy}>CARTA</button>
          <button type="button" className="casino-big-btn alt" onClick={() => act(() => casinoApi.blackjack('stand'))} disabled={busy}>STAI</button>
          {hand.canDouble && <button type="button" className="casino-big-btn gold" onClick={() => act(() => casinoApi.blackjack('double'))} disabled={busy}>RADDOPPIA</button>}
        </div>
      ) : (
        <div className="casino-actions">
          <BetCircle bet={bet} onAdd={() => setBet((b) => Math.min(1000, b + ctx.chip))} onClear={() => setBet(0)} disabled={busy} />
          <button type="button" className="casino-big-btn" onClick={() => act(() => casinoApi.blackjackDeal(bet, ctx.currency))} disabled={busy || !bet}>DISTRIBUISCI</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ video poker

const POKER_PAYS = [
  ['ROYAL_FLUSH', 'Scala reale', 250], ['STRAIGHT_FLUSH', 'Scala colore', 50], ['FOUR_OF_A_KIND', 'Poker', 25],
  ['FULL_HOUSE', 'Full', 9], ['FLUSH', 'Colore', 6], ['STRAIGHT', 'Scala', 4], ['THREE_OF_A_KIND', 'Tris', 3],
  ['TWO_PAIR', 'Doppia coppia', 2], ['JACKS_OR_BETTER', 'Coppia di J o più', 1]
];

export function VideoPokerGame({ ctx, resume }) {
  const [hand, setHand] = useState(resume || null);
  const [hold, setHold] = useState([false, false, false, false, false]);
  const [busy, setBusy] = useState(false);
  const dealt = hand && !hand.done;

  async function deal() {
    setBusy(true);
    ctx.setMessage(null);
    try {
      casinoSound.shuffle();
      const res = await casinoApi.pokerDeal(ctx.chip, ctx.currency);
      for (let i = 0; i < 5; i += 1) casinoSound.deal(0.3 + i * 0.09);
      setHand(res);
      setHold([false, false, false, false, false]);
      ctx.refresh();
    } catch (err) {
      ctx.fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function draw() {
    setBusy(true);
    try {
      const res = await casinoApi.pokerDraw(hold);
      hold.forEach((kept, i) => { if (!kept) casinoSound.flip(i * 0.09); });
      setHand(res);
      ctx.done(res, res.hand);
    } catch (err) {
      ctx.fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="casino-poker">
      <table className="casino-paytable poker">
        <tbody>
          {POKER_PAYS.map(([key, label, x]) => (
            <tr key={key} className={hand?.done && hand.handKey === key ? 'hit' : ''}><td>{label}</td><td>x{x}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="poker-screen">
        <div className="casino-cards poker-cards">
          {(hand?.cards || ['??', '??', '??', '??', '??']).map((c, i) => (
            <PlayingCard key={`${i}-${c}`} code={c} held={dealt && hold[i]} delay={i * 90}
              onClick={dealt ? () => { casinoSound.chip(); setHold((h) => h.map((v, j) => (j === i ? !v : v))); } : undefined} />
          ))}
        </div>
        <p className="poker-hint">{dealt ? 'Tocca le carte da tenere, poi CAMBIA.' : hand?.done ? hand.hand : 'Jacks or Better: dalla coppia di J in su si vince.'}</p>
        <div className="casino-actions">
          <span>Puntata <b>{formatAmount(dealt ? hand.stake : ctx.chip)}</b></span>
          {dealt
            ? <button type="button" className="casino-big-btn" onClick={draw} disabled={busy}>CAMBIA</button>
            : <button type="button" className="casino-big-btn" onClick={deal} disabled={busy}>DISTRIBUISCI</button>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ baccarat

export function BaccaratGame({ ctx }) {
  const [bets, setBets] = useState({ player: 0, banker: 0, tie: 0 });
  const [coup, setCoup] = useState(null);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const total = bets.player + bets.banker + bets.tie;

  async function deal() {
    setBusy(true);
    ctx.setMessage(null);
    setCoup(null);
    setShown(0);
    try {
      const res = await casinoApi.baccarat(bets, ctx.currency);
      setCoup(res);
      // Carte scoperte una alla volta: Punto, Banco, Punto, Banco, poi le terze.
      const n = res.player.length + res.banker.length;
      casinoSound.shuffle();
      for (let i = 1; i <= n; i += 1) {
        setShown(i);
        casinoSound.flip();
        await sleep(500);
      }
      const winner = { player: 'Vince il Punto', banker: 'Vince il Banco', tie: 'Pareggio' }[res.winner];
      ctx.done(res, `${winner} (${res.playerPoints} a ${res.bankerPoints})`);
    } catch (err) {
      ctx.fail(err);
    } finally {
      setBusy(false);
    }
  }

  // Ordine di uscita: P1, B1, P2, B2, P3, B3.
  const visible = (side, i) => {
    if (!coup) return false;
    const order = i < 2 ? i * 2 + (side === 'banker' ? 1 : 0) : 4 + (side === 'banker' ? (coup.player.length > 2 ? 1 : 0) : 0);
    return order < shown;
  };
  const area = (key, label, pays) => (
    <div className={`baccarat-area ${key}${coup && shown >= coup.player.length + coup.banker.length && coup.winner === key ? ' winner' : ''}`}>
      <BetCircle bet={bets[key]} label={label} disabled={busy}
        onAdd={() => setBets((b) => (total + ctx.chip > 2000 ? b : { ...b, [key]: Math.min(1000, b[key] + ctx.chip) }))}
        onClear={() => setBets((b) => ({ ...b, [key]: 0 }))} />
      <small>{pays}</small>
    </div>
  );

  return (
    <div className="casino-felt casino-baccarat">
      <div className="baccarat-hands">
        {['player', 'banker'].map((side) => (
          <div key={side} className="casino-hand">
            <span className="casino-hand-label">{side === 'player' ? 'PUNTO' : 'BANCO'} {coup && shown >= coup.player.length + coup.banker.length && <b>{side === 'player' ? coup.playerPoints : coup.bankerPoints}</b>}</span>
            <div className="casino-cards">
              {(coup?.[side] || []).map((c, i) => (visible(side, i) ? <PlayingCard key={`${i}-${c}`} code={c} /> : <PlayingCard key={`${i}-x`} code="??" />))}
            </div>
          </div>
        ))}
      </div>
      <div className="baccarat-bets">
        {area('player', 'PUNTO', 'paga 1 a 1')}
        {area('tie', 'PAREGGIO', 'paga 8 a 1')}
        {area('banker', 'BANCO', '1 a 1, meno il 5%')}
      </div>
      <div className="casino-actions">
        <span>Puntato: <b>{formatAmount(total)}</b></span>
        <button type="button" className="casino-big-btn" onClick={deal} disabled={busy || !total}>DISTRIBUISCI</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ dadi

export function CrapsGame({ ctx }) {
  const [bet, setBet] = useState(0);
  const [side, setSide] = useState('pass');
  const [dice, setDice] = useState([3, 4]);
  const [rolling, setRolling] = useState(false);
  const [point, setPoint] = useState(null);
  const [log, setLog] = useState([]);
  const timer = useRef(0);

  async function roll() {
    setRolling(true);
    ctx.setMessage(null);
    setLog([]);
    setPoint(null);
    try {
      const res = await casinoApi.craps(bet, side, ctx.currency);
      for (let i = 0; i < res.rolls.length; i += 1) {
        const [a, b] = res.rolls[i];
        // Dadi che girano, poi si fermano sul lancio vero.
        clearInterval(timer.current);
        timer.current = setInterval(() => setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 80);
        casinoSound.diceShake();
        await sleep(350);
        casinoSound.diceRoll();
        await sleep(300);
        clearInterval(timer.current);
        setDice([a, b]);
        setLog((l) => [...l, a + b]);
        if (i === 0 && res.point) setPoint(res.point);
        await sleep(450);
      }
      const label = res.outcome === 'win' ? 'Vinci!' : res.outcome === 'push' ? 'Pari (12 al primo lancio)' : 'Perdi';
      ctx.done(res, res.point ? `Punto ${res.point}: ${label}` : label);
    } catch (err) {
      ctx.fail(err);
    } finally {
      clearInterval(timer.current);
      setRolling(false);
    }
  }

  return (
    <div className="casino-felt casino-craps">
      <div className="craps-points">
        {[4, 5, 6, 8, 9, 10].map((n) => (
          <span key={n} className={`craps-point${point === n ? ' on' : ''}`}>{n}{point === n && <b className="craps-puck">ON</b>}</span>
        ))}
      </div>
      <div className="craps-dice">
        <Die value={dice[0]} rolling={rolling} />
        <Die value={dice[1]} rolling={rolling} />
      </div>
      <p className="craps-log">{log.length ? `Lanci: ${log.join(' · ')}` : 'Primo lancio: 7 o 11 vince, 2, 3 o 12 perde; altrimenti è il "punto" e si rilancia finché esce di nuovo (vinci) o esce il 7 (perdi).'}</p>
      <div className="craps-sides" role="radiogroup" aria-label="Linea">
        <button type="button" className={side === 'pass' ? 'active' : ''} onClick={() => setSide('pass')} disabled={rolling} aria-pressed={side === 'pass'}>PASS LINE</button>
        <button type="button" className={side === 'dontpass' ? 'active' : ''} onClick={() => setSide('dontpass')} disabled={rolling} aria-pressed={side === 'dontpass'}>DON&apos;T PASS</button>
      </div>
      <div className="casino-actions">
        <BetCircle bet={bet} onAdd={() => setBet((b) => Math.min(1000, b + ctx.chip))} onClear={() => setBet(0)} disabled={rolling} />
        <button type="button" className="casino-big-btn" onClick={roll} disabled={rolling || !bet}>LANCIA</button>
      </div>
    </div>
  );
}

