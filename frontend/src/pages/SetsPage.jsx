import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient.js';
import { collectionApi } from '../services/collectionApi.js';
import { useAuth } from '../hooks/useAuth.js';
import { getRarityColor, resolveCardImage } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

/**
 * Set da completare: per ogni set le carte che hai e quelle che mancano. A set completo si
 * ritira il premio in gold e il distintivo, che si vede anche nella scheda dell'hotel.
 */
export default function SetsPage() {
  const { refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    apiClient.get('/sets').then(setData).catch(() => setError('Set non disponibili, riprova piu\' tardi.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const claim = async (set) => {
    setBusy(set.key);
    try {
      const res = await apiClient.post(`/sets/${set.key}/claim`);
      setNotice(`Set "${set.title}" completato: +${res.reward} gold e nuovo distintivo!`);
      refreshUser();
      load();
    } catch {
      setNotice('Premio non ritirato, riprova.');
    } finally {
      setBusy(null);
    }
  };

  if (!data) return error ? <p className="page-subtitle">{error}</p> : <LoadingSpinner />;
  const done = data.sets.filter((s) => s.claimed).length;
  return (
    <section className="sets-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-stack" /> Set da completare</h2>
      <p className="page-subtitle">Raccogli tutte le carte di un set per il premio in gold e il distintivo. Completati: {done} su {data.sets.length}. Nell&apos;hotel apri la tua scheda (clic sul tuo avatar) e scegli il distintivo da mostrare accanto al nome.</p>
      {notice && <p className="sets-notice" role="status">{notice}</p>}

      {data.badges.length > 0 && (
        <div className="sets-badges" aria-label="I tuoi distintivi dei set">
          {data.badges.map((b) => (
            <span key={b.code} className="sets-badge" title={b.name}><i className={`ph-fill ph-${b.icon}`} /> {b.name}</span>
          ))}
        </div>
      )}

      <div className="sets-grid">
        {data.sets.map((set) => {
          const pct = Math.round((set.owned / set.total) * 100);
          const expanded = open === set.key;
          return (
            <article key={set.key} className={`set-card glass-panel${set.claimed ? ' claimed' : ''}${set.complete && !set.claimed ? ' ready' : ''}`}>
              <header>
                <i className={`ph-fill ph-${set.icon}`} />
                <div>
                  <h3>{set.title}</h3>
                  <span>{set.description}</span>
                </div>
                <b className="set-reward"><i className="ph-fill ph-coin" /> {set.reward}</b>
              </header>
              <div className="set-progress" role="progressbar" aria-valuenow={set.owned} aria-valuemin={0} aria-valuemax={set.total}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="set-footer">
                <span>{set.owned} / {set.total} carte</span>
                {set.claimed && <span className="set-done"><i className="ph-fill ph-seal-check" /> Completato</span>}
                {set.complete && !set.claimed && (
                  <button type="button" className="btn btn-gold btn-small" disabled={busy === set.key} onClick={() => claim(set)}>
                    <i className="ph-fill ph-gift" /> Ritira premio
                  </button>
                )}
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setOpen(expanded ? null : set.key)} aria-expanded={expanded}>
                  {expanded ? 'Nascondi' : 'Vedi carte'}
                </button>
              </div>
              {expanded && <SetCards setKey={set.key} />}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Carte di un set, a pagine da SET_PAGE: i set dei cataloghi interi ne hanno centinaia. */
const SET_PAGE = 60;

function SetCards({ setKey }) {
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(null);
  const [busy, setBusy] = useState(false);
  const fetchPage = useCallback((offset) => collectionApi.binder({ set: setKey, offset, limit: SET_PAGE }), [setKey]);
  useEffect(() => {
    let cancelled = false;
    fetchPage(0)
      .then((res) => { if (!cancelled) { setCards(res.cards); setTotal(res.total); } })
      .catch(() => { if (!cancelled) setTotal(0); });
    return () => { cancelled = true; };
  }, [fetchPage]);
  const more = () => {
    setBusy(true);
    fetchPage(cards.length)
      .then((res) => { setCards((current) => [...current, ...res.cards]); setTotal(res.total); })
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  if (total === null) return <LoadingSpinner />;
  return (
    <>
      <ul className="set-cards">
        {cards.map((card) => {
          const owned = card.owned;
          return (
                    <li key={card.id} className={owned ? 'owned' : 'missing'} style={{ '--rarity-color': getRarityColor(card.rarity) }}>
                      {owned ? (
                        <Link to={`/card/${encodeURIComponent(card.id)}`} title={card.name}>
                          <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
                        </Link>
                      ) : (
                        <span title={`${card.name} (manca)`}>
                          <img src={resolveCardImage(card)} alt={`${card.name} (manca)`} loading="lazy" />
                        </span>
                      )}
                      <small>{card.name}</small>
                    </li>
          );
        })}
      </ul>
      {cards.length < total && (
        <button type="button" className="btn btn-secondary btn-small set-more" disabled={busy} onClick={more}>
          {busy ? 'Carico…' : `Mostra altre (${total - cards.length})`}
        </button>
      )}
    </>
  );
}
