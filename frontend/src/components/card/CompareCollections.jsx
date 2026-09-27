import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extrasApi } from '../../services/extrasApi.js';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';

function Grid({ cards, picked, onPick, empty }) {
  if (!cards.length) return <p className="compare-empty">{empty}</p>;
  return (
    <div className="compare-grid">
      {cards.map((card) => (
        <button key={card.id} type="button" className={`compare-card${picked === card.id ? ' picked' : ''}`} title={card.name}
          style={{ '--rarity-color': getRarityColor(card.rarity) }} onClick={() => onPick(picked === card.id ? '' : card.id)} aria-pressed={picked === card.id}>
          <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
        </button>
      ))}
    </div>
  );
}

/**
 * Confronto fra la tua collezione e quella di un altro giocatore: le carte che ha lui e ti
 * mancano, e quelle che hai tu e gli mancano. Scegline una per parte e parte lo scambio.
 */
export default function CompareCollections({ user, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [want, setWant] = useState('');
  const [give, setGive] = useState('');

  useEffect(() => {
    let cancelled = false;
    extrasApi.compare(user.id).then((res) => { if (!cancelled) setData(res); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [user.id]);

  const propose = () => {
    const params = new URLSearchParams({ to: user.username });
    if (give) params.set('give', give);
    if (want) params.set('want', want);
    navigate(`/trades?${params}`);
  };

  return (
    <div className="hotel-panel compare-panel" role="dialog" aria-label={`Confronto con ${user.username}`}>
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-arrows-left-right" /> Tu e {user.username}</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      {error && <p className="hotel-panel-error">Confronto non riuscito, riprova.</p>}
      {!data && !error && <p className="hotel-panel-hint">Confronto le collezioni…</p>}
      {data && (
        <div className="compare-body">
          <p className="hotel-panel-hint">Carte in comune: {data.common}. Scegli una carta per parte e proponi lo scambio.</p>
          <h4 className="events-sub">Ha lui, a te mancano ({data.theyHave.length})</h4>
          <Grid cards={data.theyHave} picked={want} onPick={setWant} empty="Niente che ti manchi." />
          <h4 className="events-sub">Hai tu, a lui mancano ({data.youHave.length})</h4>
          <Grid cards={data.youHave} picked={give} onPick={setGive} empty="Ha gia' tutte le tue carte." />
        </div>
      )}
      <footer className="hotel-panel-footer">
        <button type="button" className="btn btn-primary btn-small" disabled={!give} onClick={propose}
          title={give ? undefined : 'Scegli almeno una tua carta da offrire'}>
          <i className="ph-fill ph-handshake" /> Proponi scambio
        </button>
      </footer>
    </div>
  );
}
