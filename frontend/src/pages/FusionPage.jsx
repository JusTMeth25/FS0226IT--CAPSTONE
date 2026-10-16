import { useCallback, useEffect, useMemo, useState } from 'react';
import { m } from 'motion/react';
import { apiClient } from '../services/apiClient.js';
import { useGame } from '../hooks/useGame.js';
import { getRarityColor, getRarityName, resolveCardImage } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import StarBurst from '../components/phantom/StarBurst.jsx';
import '../styles/pages/collection-phantom.css';

const ERRORS = {
  fusion_not_duplicate: 'Puoi fondere solo i doppioni: di ogni carta ne resta sempre una.',
  fusion_mixed_rarity: 'Le tre carte devono essere della stessa rarità.',
  fusion_no_cards: 'Non ci sono carte della rarità successiva da ottenere.'
};

/**
 * Fusione: tre doppioni della stessa rarità diventano una carta a caso della rarità successiva.
 * Di ogni carta resta sempre almeno una copia, quindi la collezione non perde niente.
 */
export default function FusionPage() {
  const { refreshCollection } = useGame();
  const [data, setData] = useState(null);
  const [rarity, setRarity] = useState(null);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    apiClient.get('/fusion').then((res) => {
      setData(res);
      setRarity((r) => r || Object.keys(res.groups).find((k) => res.groups[k].reduce((n, e) => n + e.spare, 0) >= res.size) || 'common');
    }).catch(() => setError('Fusione non disponibile, riprova.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const group = useMemo(() => data?.groups[rarity] || [], [data, rarity]);
  const size = data?.size || 3;
  const count = (id) => picked.filter((p) => p === id).length;

  const toggle = (entry) => {
    const id = entry.card.id;
    setError(null);
    setPicked((p) => {
      if (count(id) < entry.spare && p.length < size) return [...p, id];
      const i = p.lastIndexOf(id);
      return i >= 0 ? [...p.slice(0, i), ...p.slice(i + 1)] : p;
    });
  };

  const fuse = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post('/fusion', { cards: picked });
      setResult(res);
      setPicked([]);
      refreshCollection();
      load();
    } catch (err) {
      setError(ERRORS[err?.code] || 'Fusione non riuscita, riprova.');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return error ? <p className="page-subtitle">{error}</p> : <LoadingSpinner />;
  const rarities = Object.keys(data.groups);
  const byId = new Map(group.map((e) => [e.card.id, e.card]));
  return (
    <section className="fusion-page">
      <header className="cx-head">
        <PhantomTitle text="Fusione" className="cx-title" />
      </header>
      <p className="page-subtitle">Scegli {size} doppioni della stessa rarità: diventano una carta della rarità successiva. Di ogni carta ne tieni sempre una.</p>

      <div className="fusion-tabs" role="tablist">
        {rarities.map((r) => {
          const spare = data.groups[r].reduce((n, e) => n + e.spare, 0);
          return (
            <button key={r} type="button" role="tab" aria-selected={r === rarity}
              className={`fusion-tab${r === rarity ? ' active' : ''}`} style={{ '--rarity-color': getRarityColor(r) }}
              onClick={() => { setRarity(r); setPicked([]); }}>
              {getRarityName(r)} <small>{spare} doppioni</small>
            </button>
          );
        })}
      </div>

      <div className="fusion-bench">
        <div className="fusion-slots" aria-label="Carte scelte">
          {Array.from({ length: size }, (_, i) => {
            const card = byId.get(picked[i]);
            return (
              <div key={i} className={`fusion-slot${card ? ' filled' : ''}${busy ? ' melting' : ''}`} style={{ '--rarity-color': getRarityColor(rarity) }}>
                {card ? <img loading="lazy" decoding="async" src={resolveCardImage(card)} alt={card.name} /> : <i className="ph ph-plus" />}
              </div>
            );
          })}
        </div>
        {/* Fondere e' l'azione della pagina: magenta (l'oro resta ai premi). */}
        <button type="button" className="btn btn-primary btn-large fusion-go" disabled={picked.length !== size || busy} onClick={fuse}>
          <i className="ph-fill ph-flask" /> {busy ? 'Fusione in corso…' : 'Fondi'}
        </button>
        {error && <p className="fusion-error" role="alert">{error}</p>}
      </div>

      {result && (
        // Fusione riuscita: lampo magenta in diagonale, poi la carta nuova arriva ruotando sulla stella.
        <div className="fusion-result" role="status" key={result.card.id} style={{ '--rarity-color': getRarityColor(result.card.rarity) }}>
          <m.span className="cx-fuse-flash" aria-hidden="true" initial={{ x: '-120%' }} animate={{ x: '120%' }}
            transition={{ duration: 0.28, ease: [0.7, 0, 0.3, 1] }} />
          <m.div className="cx-fuse-card" initial={{ scale: 0.4, rotate: -24, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 460, damping: 20, delay: 0.12 }}>
            <StarBurst size={170} fill="var(--neon-magenta)" stroke="#fff" className="cx-fuse-star" />
            <img src={resolveCardImage(result.card)} alt={result.card.name} />
          </m.div>
          <m.div className="cx-fuse-text" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26, delay: 0.22 }}>
            <span className="cx-fuse-kicker">Fusione riuscita!</span>
            <span>Dalla fusione è nata</span>
            <strong>{result.card.name}</strong>
            <span className="cx-fuse-rarity">{getRarityName(result.card.rarity)}</span>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setResult(null)}>Continua</button>
          </m.div>
        </div>
      )}

      {group.length === 0 ? (
        <p className="page-subtitle">Nessun doppione di questa rarità. Apri pacchetti per trovarne!</p>
      ) : (
        <ul className="fusion-grid">
          {group.map((entry) => {
            const n = count(entry.card.id);
            return (
              <li key={entry.card.id}>
                <button type="button" className={`fusion-card${n ? ' picked' : ''}`} onClick={() => toggle(entry)}
                  style={{ '--rarity-color': getRarityColor(entry.card.rarity) }} aria-pressed={n > 0} title={entry.card.name}>
                  <img src={resolveCardImage(entry.card)} alt={entry.card.name} loading="lazy" />
                  <span className="fusion-spare">{n > 0 ? `${n}/` : ''}{entry.spare} doppi</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
