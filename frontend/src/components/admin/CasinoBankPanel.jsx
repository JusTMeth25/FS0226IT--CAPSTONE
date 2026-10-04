import { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi.js';

const fmt = (n) => Number(n || 0).toLocaleString('it-IT');
const ERRORS = {
  vault_go_to_safe: 'Si riscuote solo dalla cassaforte, dentro il Caveau del casinò.',
  casino_bank_empty: 'Non c\'è niente da riscuotere.',
  casino_bank_not_enough: 'Nella cassa non c\'è così tanto.'
};

/**
 * Cassa del banco del casino, per il gestore (admin): quanto ha guadagnato il casino (fiches e
 * gold), quanto e' gia' stato riscosso e il pulsante per riscuotere, tutto o una parte.
 * La usano la pagina Admin e la cassa del casino nell'hotel.
 */
export default function CasinoBankPanel({ onWithdrawn, compact = false, canWithdraw = false }) {
  const [bank, setBank] = useState(null);
  const [amount, setAmount] = useState({ chips: '', gold: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    adminApi.getCasinoBank().then((res) => { if (!cancelled) setBank(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function withdraw(currency) {
    setBusy(true);
    setMessage(null);
    try {
      const value = Number(amount[currency]) || 0;
      const res = await adminApi.withdrawCasino(currency, value > 0 ? value : null);
      setBank(res);
      setAmount((a) => ({ ...a, [currency]: '' }));
      setMessage({ type: 'success', text: `Riscossi ${fmt(res.taken)} ${currency === 'gold' ? 'gold' : 'fiches'}.` });
      onWithdrawn?.(res);
    } catch (err) {
      setMessage({ type: 'error', text: ERRORS[err.code] || err.message });
    } finally {
      setBusy(false);
    }
  }

  if (!bank) return <p className="casino-bank-loading">Apro la cassa del banco…</p>;

  return (
    <div className={`casino-bank${compact ? ' compact' : ''}`}>
      {[['chips', 'Fiches', 'ph-poker-chip'], ['gold', 'Gold', 'ph-coin']].map(([key, label, icon]) => {
        const row = bank[key] || {};
        return (
          <div key={key} className="casino-bank-row">
            <div className="casino-bank-head">
              <i className={`ph-fill ${icon}`} /> {label}
              <b className={row.balance < 0 ? 'neg' : ''}>{fmt(row.balance)}</b>
            </div>
            <small>Guadagnati in tutto {fmt(row.earned)} · già riscossi {fmt(row.withdrawn)}</small>
            {canWithdraw && (
              <div className="casino-bank-actions">
                <input type="number" min="1" placeholder="tutto" value={amount[key]} aria-label={`${label} da riscuotere`}
                  onChange={(e) => setAmount((a) => ({ ...a, [key]: e.target.value }))} />
                <button type="button" className="btn btn-gold btn-small" disabled={busy || !(row.balance > 0)} onClick={() => withdraw(key)}>
                  Riscuoti
                </button>
              </div>
            )}
          </div>
        );
      })}
      {!canWithdraw && <p className="casino-bank-where"><i className="ph-fill ph-vault" /> Si riscuote dalla cassaforte del Caveau: nell'hotel, porta blindata del Casinò.</p>}
      {message && <div className={`auth-message auth-message-${message.type}`}>{message.text}</div>}
      {!compact && bank.history?.length > 0 && (
        <ul className="casino-bank-history">
          {bank.history.map((h, i) => (
            <li key={i}>{new Date(h.at).toLocaleString('it-IT')} · {h.username} · {fmt(h.amount)} {h.currency === 'GOLD' ? 'gold' : 'fiches'}</li>
          ))}
        </ul>
      )}
      <p className="casino-bank-note">Entrano le puntate perse dai giocatori ed escono le vincite (anche quelle dei tavoli, del bingo e dei cavalli). Il cambio alla cassa e il regalo giornaliero non contano.</p>
    </div>
  );
}
