import { useEffect, useRef, useState } from 'react';
import AvatarPreview from '../AvatarPreview.jsx';
import { Chip, PlayingCard } from './casinoParts.jsx';
import { formatAmount } from './casinoUtils.js';
import { casinoSound } from './casinoSounds.js';
import { pokerBus } from './pokerBus.js';

/**
 * Tavolo del Texas Hold'em: sei posti attorno al panno ovale, con i giocatori veri e gli NPC del
 * casino. Tutto lo decide il server (PokerTable): qui si mostra lo stato e si mandano le mosse.
 * Il proprio posto sta sempre in basso al centro; gli altri girano attorno al tavolo.
 */

const PHASES = { waiting: 'In attesa di giocatori', preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown' };
const ERRORS = {
  poker_bad_buy_in: 'Ci si siede con 100-2000 fiches.',
  poker_already_seated: 'Sei già seduto al tavolo.',
  poker_table_full: 'Il tavolo è pieno: aspetta che si liberi un posto.',
  poker_not_your_turn: 'Non tocca a te.',
  poker_cannot_check: 'Non puoi passare: c\'è una puntata da chiamare.',
  poker_bad_raise: 'Rilancio troppo basso.',
  casino_not_enough_chips: 'Non hai abbastanza fiches: passa dalla cassa.',
  casino_not_here: 'Si gioca solo dentro il Casinò.'
};

function SeatView({ seat, position, isButton, isTurn, turnLeft, turnMillis }) {
  if (seat.empty) return <div className={`holdem-seat pos-${position} empty`}><span>Posto libero</span></div>;
  const pct = isTurn && turnMillis ? Math.max(0, Math.min(100, (turnLeft / turnMillis) * 100)) : 0;
  return (
    <div className={`holdem-seat pos-${position}${seat.me ? ' me' : ''}${seat.folded ? ' folded' : ''}${isTurn ? ' turn' : ''}${seat.won > 0 ? ' winner' : ''}${!seat.inHand ? ' out' : ''}`}>
      <div className="holdem-avatar"><AvatarPreview look={seat.look} scale={1.25} /></div>
      <div className="holdem-plate">
        <strong>{seat.name}{seat.bot && <i className="ph-fill ph-robot" title="NPC del casinò" />}</strong>
        <span><Chip value={25} size={13} label="fiches" /> {formatAmount(seat.stack)}</span>
        {isTurn && <i className="holdem-timer" style={{ width: `${pct}%` }} />}
      </div>
      {seat.cards?.length > 0 && !seat.me && (
        <div className="holdem-hole">{seat.cards.map((c, i) => <PlayingCard key={`${i}-${c}`} code={c} small />)}</div>
      )}
      {seat.action && <em className="holdem-action">{seat.action}</em>}
      {seat.handName && <em className="holdem-handname">{seat.handName}</em>}
      {seat.won > 0 && <em className="holdem-won">+{formatAmount(seat.won)}</em>}
      {seat.bet > 0 && <span className="holdem-bet"><Chip value={seat.bet} size={20} /> {formatAmount(seat.bet)}</span>}
      {isButton && <b className="holdem-dealer" title="Mazziere">D</b>}
    </div>
  );
}

export default function HoldemGame({ ctx, wallet, send }) {
  const [table, setTable] = useState(() => pokerBus.last());
  const [buyIn, setBuyIn] = useState(500);
  const [raisePick, setRaisePick] = useState({ key: '', value: 0 });
  const [, setNow] = useState(0);
  const prev = useRef(null);

  // ctx cambia a ogni disegno del pannello: lo si legge da un riferimento, cosi' l'iscrizione resta una.
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; });

  // Stato dal server: si chiede appena si apre il tavolo, poi arriva a ogni cambiamento.
  useEffect(() => {
    send({ type: 'poker_watch' });
    return pokerBus.subscribe((event) => {
      const ctx = ctxRef.current;
      if (event.type === 'state') setTable(event.table);
      if (event.type === 'cashout') {
        ctx.refresh();
        ctx.setMessage({ tone: event.chips > 0 ? 'win' : 'lose', text: event.reason === 'busted' ? 'Hai finito le fiches: ti sei alzato dal tavolo.' : `Ti sei alzato con ${formatAmount(event.chips)} fiches.` });
      }
      if (event.type === 'error') ctx.setMessage({ tone: 'lose', text: ERRORS[event.code] || 'Mossa non valida.' });
    });
  }, [send]);

  // Il tempo del turno scorre anche fra un messaggio e l'altro.
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  // Suoni: carte distribuite, carte sul tavolo, fiches puntate, vincita.
  useEffect(() => {
    const before = prev.current;
    prev.current = table;
    if (!table || !before) return;
    if (table.hand !== before.hand && table.phase === 'preflop') {
      casinoSound.shuffle();
      table.seats.filter((s) => s.inHand).forEach((_, i) => casinoSound.deal(0.3 + i * 0.12));
    }
    if (table.board.length > before.board.length) for (let i = before.board.length; i < table.board.length; i += 1) casinoSound.flip((i - before.board.length) * 0.15);
    const bets = (t) => t.seats.reduce((sum, s) => sum + (s.bet || 0), 0);
    if (table.hand === before.hand && bets(table) > bets(before)) casinoSound.chip();
    const me = table.seats.find((s) => s.me);
    const meBefore = before.seats.find((s) => s.me);
    if (me && me.won > 0 && !(meBefore?.won > 0)) casinoSound.win(me.won >= 500);
    if (table.you?.myTurn && !before.you?.myTurn) casinoSound.bell();
  }, [table]);

  // Rilancio scelto con il cursore: vale per il turno in corso, poi si riparte dal minimo.
  const you = table?.you;
  const raiseKey = you ? `${table.hand}-${table.phase}-${you.minRaiseTo}` : '';
  const raise = raisePick.key === raiseKey ? raisePick.value : you?.minRaiseTo ?? 0;
  const setRaise = (value) => setRaisePick({ key: raiseKey, value });

  if (!table) return <p className="holdem-loading">Mi siedo al tavolo verde…</p>;

  const mySeat = you ? you.seat : null;
  // Il proprio posto in basso al centro (posizione 0), gli altri in senso orario.
  const position = (seatIndex) => (mySeat == null ? seatIndex : (seatIndex - mySeat + 6) % 6);
  const turnLeft = table.turnLeft;
  const act = (action, amount = 0) => {
    if (action === 'raise' || action === 'allin' || action === 'call') casinoSound.chip();
    send({ type: 'poker_action', action, amount });
  };
  const sit = () => {
    casinoSound.chipStack(5);
    send({ type: 'poker_join', buyIn });
  };
  const pot = table.pot;
  const preset = (fraction) => {
    const to = Math.round((table.currentBet + Math.max(you.toCall, 0) + pot * fraction) / 5) * 5;
    setRaise(Math.max(you.minRaiseTo, Math.min(you.maxRaiseTo, to)));
  };
  const chips = wallet?.chips ?? 0;
  const myCards = mySeat != null ? table.seats[mySeat]?.cards || [] : [];

  return (
    <div className="casino-holdem">
      <div className="holdem-table">
        <div className="holdem-felt">
          <div className="holdem-center">
            <span className="holdem-phase">{PHASES[table.phase] || table.phase}{table.hand > 0 ? ` · mano #${table.hand}` : ''} · bui {table.smallBlind}/{table.bigBlind}</span>
            <div className="holdem-board">
              {[0, 1, 2, 3, 4].map((i) => (table.board[i] ? <PlayingCard key={`${i}-${table.board[i]}`} code={table.board[i]} small /> : <span key={i} className="holdem-slot" />))}
            </div>
            <span className="holdem-pot"><Chip value={100} size={18} /> Piatto {formatAmount(pot)}</span>
            {table.results?.length > 0 && (
              <div className="holdem-results">
                {table.results.map((r, i) => <span key={i}>{r.name} vince {formatAmount(r.amount)}{r.hand ? ` · ${r.hand}` : ''}</span>)}
              </div>
            )}
          </div>
        </div>
        {table.seats.map((seat) => (
          <SeatView key={seat.seat} seat={seat} position={position(seat.seat)} isButton={table.button === seat.seat && table.phase !== 'waiting'}
            isTurn={table.turn === seat.seat} turnLeft={turnLeft} turnMillis={table.turnMillis} />
        ))}
      </div>

      <div className="holdem-controls">
        {!you ? (
          <div className="holdem-join">
            <span>Siediti con <b>{formatAmount(buyIn)}</b> fiches</span>
            <input type="range" min={table.minBuyIn} max={Math.max(table.minBuyIn, Math.min(table.maxBuyIn, chips))} step={50} value={Math.min(buyIn, Math.max(table.minBuyIn, chips))}
              onChange={(e) => setBuyIn(Number(e.target.value))} aria-label="Fiches da portare al tavolo" disabled={chips < table.minBuyIn} />
            <button type="button" className="casino-big-btn gold" onClick={sit} disabled={chips < table.minBuyIn}>SIEDITI</button>
            {chips < table.minBuyIn && <small>Servono almeno {table.minBuyIn} fiches: cambiale alla cassa (c&apos;è anche il regalo di oggi).</small>}
          </div>
        ) : (
          <>
            <div className="holdem-mine">
              <div className="casino-cards">{myCards.map((c, i) => <PlayingCard key={`${i}-${c}`} code={c} />)}</div>
              <span>{you.handName || (myCards.length ? 'Le tue carte' : 'Aspetta la prossima mano')}</span>
            </div>
            {you.myTurn ? (
              <div className="holdem-actions">
                <button type="button" className="casino-big-btn alt" onClick={() => act('fold')}>LASCIA</button>
                {you.canCheck
                  ? <button type="button" className="casino-big-btn" onClick={() => act('check')}>CHECK</button>
                  : <button type="button" className="casino-big-btn" onClick={() => act('call')}>CHIAMA {formatAmount(you.toCall)}</button>}
                {you.maxRaiseTo > table.currentBet && (
                  <div className="holdem-raise">
                    <input type="range" min={you.minRaiseTo} max={you.maxRaiseTo} step={5} value={raise} onChange={(e) => setRaise(Number(e.target.value))} aria-label="Rilancio" />
                    <div className="holdem-presets">
                      <button type="button" onClick={() => preset(0.5)}>½ piatto</button>
                      <button type="button" onClick={() => preset(1)}>Piatto</button>
                      <button type="button" onClick={() => setRaise(you.maxRaiseTo)}>Tutto</button>
                    </div>
                    <button type="button" className="casino-big-btn gold" onClick={() => act(raise >= you.maxRaiseTo ? 'allin' : 'raise', raise)}>
                      {raise >= you.maxRaiseTo ? 'ALL-IN' : `${table.currentBet === 0 ? 'PUNTA' : 'RILANCIA A'} ${formatAmount(raise)}`}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="holdem-wait">
                {you.leaving ? 'Ti alzi alla fine della mano.' : table.phase === 'waiting' ? 'Si parte appena ci sono due giocatori.' : 'Tocca agli altri…'}
              </div>
            )}
            <button type="button" className="btn btn-secondary btn-small holdem-leave" onClick={() => send({ type: 'poker_leave' })} disabled={you.leaving}>
              <i className="ph ph-sign-out" /> Alzati
            </button>
          </>
        )}
        <ul className="holdem-log" aria-label="Cronaca del tavolo">
          {(table.log || []).slice(-4).map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
        </ul>
      </div>
    </div>
  );
}
