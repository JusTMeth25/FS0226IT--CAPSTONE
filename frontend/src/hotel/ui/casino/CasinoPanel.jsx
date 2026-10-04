import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { casinoApi, casinoError } from '../../../services/casinoApi.js';
import { Chip, ChipSelector } from './casinoParts.jsx';
import { CASINO_GAMES, formatAmount, outcomeText } from './casinoUtils.js';
import { casinoSound, outcomeSound } from './casinoSounds.js';
import { CASINO_GUIDES } from './casinoGuides.js';
import { BaccaratGame, BlackjackGame, CrapsGame, RouletteGame, SlotGame, VideoPokerGame } from './games.jsx';
import HoldemGame from './HoldemGame.jsx';
import './casino.css';

/**
 * Casino dell'hotel: si apre cliccando un tavolo, una slot o la cassa. In alto i saldi (fiches e
 * gold), la valuta con cui puntare e il taglio della fiche; sotto il tavolo scelto. Tutto lo
 * decide il server (CasinoService): qui ci sono solo il tavolo e le animazioni.
 */

/** Guida del gioco: obiettivo, come si gioca qui, regole, paghe e un consiglio. */
function Guide({ game, onClose }) {
  const g = CASINO_GUIDES[game];
  if (!g) return null;
  return (
    <div className="casino-guide" role="dialog" aria-label={`Come si gioca: ${g.title}`}>
      <div className="casino-guide-card">
        <header>
          <h4><i className="ph-fill ph-book-open-text" /> {g.title}</h4>
          <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi la guida"><i className="ph ph-x" /></button>
        </header>
        <div className="casino-guide-body">
          <p className="casino-guide-goal"><b>Obiettivo.</b> {g.goal}</p>
          <h5>Come si gioca</h5>
          <ol>{g.steps.map((t) => <li key={t}>{t}</li>)}</ol>
          <h5>Regole</h5>
          <ul>{g.rules.map((t) => <li key={t}>{t}</li>)}</ul>
          {g.pays && (
            <>
              <h5>Paghe</h5>
              <table className="casino-guide-pays"><tbody>{g.pays.map(([what, pay]) => <tr key={what}><td>{what}</td><td>{pay}</td></tr>)}</tbody></table>
            </>
          )}
          {g.tip && <p className="casino-guide-tip"><i className="ph-fill ph-lightbulb" /> {g.tip}</p>}
        </div>
        <button type="button" className="casino-big-btn gold" onClick={onClose}>HO CAPITO</button>
      </div>
    </div>
  );
}

function Cashier({ wallet, onChange, setMessage }) {
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);

  async function run(call, okText) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await call();
      casinoSound.register();
      onChange(res);
      setMessage({ tone: 'win', text: okText(res) });
    } catch (err) {
      setMessage({ tone: 'lose', text: casinoError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="casino-cashier">
      <div className="cashier-window">
        <h4>Cambio fiches</h4>
        <p>1 gold = 1 fiche, in tutte e due le direzioni.</p>
        <div className="cashier-amounts">
          {[50, 100, 250, 500, 1000].map((v) => (
            <button key={v} type="button" className={amount === v ? 'active' : ''} onClick={() => setAmount(v)}>{formatAmount(v)}</button>
          ))}
          <input type="number" min="1" max="100000" value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(100000, Number(e.target.value) || 1)))} aria-label="Importo" />
        </div>
        <div className="casino-actions">
          <button type="button" className="casino-big-btn" disabled={busy} onClick={() => run(() => casinoApi.exchange('buy', amount), () => `Ecco ${formatAmount(amount)} fiches. Buon divertimento!`)}>
            COMPRA FICHES
          </button>
          <button type="button" className="casino-big-btn alt" disabled={busy} onClick={() => run(() => casinoApi.exchange('sell', amount), () => `Cambiate ${formatAmount(amount)} fiches in gold.`)}>
            CAMBIA IN GOLD
          </button>
        </div>
      </div>
      <div className="cashier-window bonus">
        <h4>Regalo della casa</h4>
        <p>{wallet?.dailyChips || 200} fiches gratis ogni giorno, per giocare senza toccare i gold.</p>
        <button type="button" className="casino-big-btn gold" disabled={busy || !wallet?.bonusReady}
          onClick={() => run(() => casinoApi.bonus(), (res) => `Regalo ritirato: ${res.bonus} fiches!`)}>
          {wallet?.bonusReady ? 'RITIRA IL REGALO' : 'GIÀ RITIRATO OGGI'}
        </button>
      </div>
    </div>
  );
}

const GUIDE_KEY = 'vinyldex_casino_guides';
function seenGuide(game) {
  try {
    return JSON.parse(localStorage.getItem(GUIDE_KEY) || '[]').includes(game);
  } catch {
    return true;
  }
}
function markGuide(game) {
  try {
    const seen = JSON.parse(localStorage.getItem(GUIDE_KEY) || '[]');
    if (!seen.includes(game)) localStorage.setItem(GUIDE_KEY, JSON.stringify([...seen, game]));
  } catch {
    // Senza localStorage la guida si ripresenta la volta dopo: niente di grave.
  }
}

export default function CasinoPanel({ game: initialGame, send, onClose, onGoldChange }) {
  const [game, setGame] = useState(initialGame || 'cashier');
  const [wallet, setWallet] = useState(null);
  const [currency, setCurrency] = useState('chips');
  const [chip, setChip] = useState(5);
  const [message, setMessage] = useState(null);
  const panelRef = useRef(null);
  // La guida si apre da sola la prima volta che si apre un gioco.
  const [guide, setGuide] = useState(() => !seenGuide(initialGame || 'cashier'));
  const openGame = (key) => {
    setGame(key);
    setMessage(null);
    setGuide(!seenGuide(key));
  };
  const closeGuide = () => {
    markGuide(game);
    setGuide(false);
  };

  const applyBalances = useCallback((res) => {
    if (res?.chips == null) return;
    setWallet((w) => ({ ...(w || {}), ...res, bonusReady: res.bonus ? false : w?.bonusReady }));
    onGoldChange?.(res.gold);
  }, [onGoldChange]);

  const refresh = useCallback(() => {
    casinoApi.wallet().then((w) => { setWallet(w); onGoldChange?.(w.gold); }).catch(() => {});
  }, [onGoldChange]);

  useEffect(() => {
    let cancelled = false;
    casinoApi.wallet().then((w) => { if (!cancelled) setWallet(w); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const unit = currency === 'gold' ? 'gold' : 'fiches';
  const ctx = {
    currency,
    chip,
    setMessage,
    refresh,
    done: (res, label) => {
      applyBalances(res);
      // Il blackjack servito ha gia' la sua fanfara.
      if (res.outcome !== 'blackjack') outcomeSound(res);
      const o = outcomeText(res, unit);
      setMessage({ tone: o.tone, text: label ? `${label} · ${o.text}` : o.text });
    },
    fail: (err) => setMessage({ tone: 'lose', text: casinoError(err) })
  };

  const balance = currency === 'gold' ? wallet?.gold : wallet?.chips;

  // Su telefono (in verticale e in orizzontale) il casino copre tutta la pagina: la scena dell'hotel e' piccola.
  const fullScreen = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px), (orientation: landscape) and (max-height: 520px)').matches;
  const panel = (
    <div ref={panelRef} className={`hotel-panel casino-panel${fullScreen ? ' full' : ''}${guide ? ' with-guide' : ''}`} role="dialog" aria-label={`Casinò: ${CASINO_GAMES[game].title}`}>
      <header className="casino-header">
        <div className="casino-brand"><span>♠</span> CASINÒ <span>♥</span></div>
        <div className="casino-balances">
          <span title="Fiches"><Chip value={25} size={22} label="Fiches" /> {formatAmount(wallet?.chips ?? 0)}</span>
          <span title="Gold"><i className="ph-fill ph-coin" /> {formatAmount(wallet?.gold ?? 0)}</span>
        </div>
        <button type="button" className="casino-help-btn" onClick={() => { panelRef.current?.scrollTo({ top: 0 }); setGuide(true); }} title="Come si gioca e regole" aria-label="Come si gioca e regole">
          <i className="ph-fill ph-question" /> <span>Come si gioca</span>
        </button>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <nav className="casino-tabs" aria-label="Giochi">
        {Object.entries(CASINO_GAMES).map(([key, g]) => (
          <button key={key} type="button" className={game === key ? 'active' : ''} onClick={() => openGame(key)} aria-pressed={game === key}>
            <i className={`ph ${g.icon}`} /> {g.title}
          </button>
        ))}
      </nav>
      {game !== 'cashier' && game !== 'holdem' && (
        <div className="casino-toolbar">
          <div className="casino-currency" role="radiogroup" aria-label="Punta in">
            <button type="button" className={currency === 'chips' ? 'active' : ''} onClick={() => setCurrency('chips')} aria-pressed={currency === 'chips'}>Fiches</button>
            <button type="button" className={currency === 'gold' ? 'active' : ''} onClick={() => setCurrency('gold')} aria-pressed={currency === 'gold'}>Gold</button>
          </div>
          <ChipSelector value={chip} onChange={setChip} max={1000} />
          <span className="casino-balance-now">Hai <b>{formatAmount(balance ?? 0)}</b> {unit}</span>
        </div>
      )}
      {message && <div key={message.text + message.tone + (wallet?.chips ?? '') + (wallet?.gold ?? '')} className={`casino-message ${message.tone}`} role="status">{message.text}</div>}
      <div className="casino-body">
        {game === 'cashier' && <Cashier wallet={wallet} onChange={applyBalances} setMessage={setMessage} />}
        {game === 'slot' && <SlotGame ctx={ctx} />}
        {game === 'roulette' && <RouletteGame ctx={ctx} />}
        {game === 'blackjack' && <BlackjackGame ctx={ctx} resume={wallet?.blackjack} key={wallet?.blackjack ? 'bj-resume' : 'bj'} />}
        {game === 'poker' && <VideoPokerGame ctx={ctx} resume={wallet?.poker} key={wallet?.poker ? 'vp-resume' : 'vp'} />}
        {game === 'baccarat' && <BaccaratGame ctx={ctx} />}
        {game === 'craps' && <CrapsGame ctx={ctx} />}
        {game === 'holdem' && <HoldemGame ctx={ctx} wallet={wallet} send={send} />}
      </div>
      {guide && <Guide game={game} onClose={closeGuide} />}
      {game !== 'cashier' && wallet && wallet.chips === 0 && currency === 'chips' && (
        <p className="casino-tip">Niente fiches? Passa alla <button type="button" className="casino-link" onClick={() => setGame('cashier')}>cassa</button>: c&apos;è anche il regalo di oggi.</p>
      )}
    </div>
  );
  return fullScreen ? createPortal(panel, document.body) : panel;
}
