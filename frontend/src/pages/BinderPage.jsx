import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionApi } from '../services/collectionApi.js';
import { apiClient } from '../services/apiClient.js';
import { SOURCE_LABELS, getRarityColor, resolveCardImage } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

const PER_PAGE = 9;
const TURN_MS = 320;

/** Una pagina del raccoglitore: nove tasche, le carte che mancano sono sagome grigie. */
function BinderPage({ cards, number }) {
  return (
    <div className="binder-sheet">
      <div className="binder-pockets">
        {Array.from({ length: PER_PAGE }, (_, i) => {
          const card = cards[i];
          if (!card) return <div key={i} className="binder-pocket empty-slot" />;
          return (
            <div key={card.id} className={`binder-pocket${card.owned ? ' owned' : ' missing'}`} style={{ '--rarity-color': getRarityColor(card.rarity) }}>
              {card.owned ? (
                <Link to={`/card/${encodeURIComponent(card.id)}`} title={card.name}>
                  <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
                </Link>
              ) : (
                <span title={`${card.name} (manca)`}>
                  <img src={resolveCardImage(card)} alt={`${card.name} (manca)`} loading="lazy" />
                  <small>{card.number || '?'}</small>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <span className="binder-page-number">{number}</span>
    </div>
  );
}

/**
 * Raccoglitore: la collezione come un album vero, gioco per gioco o set per set, nove tasche per
 * pagina e due pagine aperte. Le pagine si sfogliano con le frecce (anche da tastiera).
 */
export default function BinderViewPage() {
  const [source, setSource] = useState('original');
  const [setKey, setSetKey] = useState('');
  const [sets, setSets] = useState([]);
  const [cards, setCards] = useState(null);
  const [spread, setSpread] = useState(0);
  const [turning, setTurning] = useState(null);
  const [single, setSingle] = useState(() => window.innerWidth < 900);

  useEffect(() => {
    apiClient.get('/sets').then((res) => setSets(res.sets)).catch(() => setSets([]));
    const onResize = () => setSingle(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (setKey) {
      const set = sets.find((s) => s.key === setKey);
      Promise.resolve(set ? set.cards.map(({ card, owned }) => ({ ...card, owned })) : []).then((list) => {
        if (!cancelled) { setCards(list); setSpread(0); }
      });
    } else {
      collectionApi.getCollection({ source }).then((res) => {
        if (cancelled) return;
        const list = [...(res.collection || [])].sort((a, b) => (a.setCode || '').localeCompare(b.setCode || '')
          || String(a.number || '').localeCompare(String(b.number || ''), undefined, { numeric: true })
          || a.name.localeCompare(b.name));
        setCards(list);
        setSpread(0);
      }).catch(() => setCards([]));
    }
    return () => { cancelled = true; };
  }, [source, setKey, sets]);

  const perSpread = single ? PER_PAGE : PER_PAGE * 2;
  const pages = useMemo(() => {
    const list = cards || [];
    return Array.from({ length: Math.max(1, Math.ceil(list.length / PER_PAGE)) }, (_, i) => list.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
  }, [cards]);
  const spreads = Math.max(1, Math.ceil((cards?.length || 0) / perSpread));

  const turn = useCallback((dir) => {
    if (turning) return;
    const next = spread + dir;
    if (next < 0 || next >= spreads) return;
    setTurning(dir > 0 ? 'next' : 'prev');
    setTimeout(() => setSpread(next), TURN_MS);
    setTimeout(() => setTurning(null), TURN_MS * 2);
  }, [spread, spreads, turning]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight') turn(1);
      if (e.key === 'ArrowLeft') turn(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  const owned = (cards || []).filter((c) => c.owned).length;
  const first = spread * (single ? 1 : 2);
  return (
    <section className="binder-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-book-open" /> Raccoglitore</h2>
      <div className="binder-controls">
        <label>
          Gioco
          <select value={setKey ? '' : source} onChange={(e) => { setSetKey(''); setSource(e.target.value); }}>
            {Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          oppure set
          <select value={setKey} onChange={(e) => setSetKey(e.target.value)}>
            <option value="">—</option>
            {sets.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
        </label>
        <span className="binder-count">{owned} / {cards?.length || 0} carte</span>
      </div>

      {!cards ? <LoadingSpinner /> : (
        <>
          <div className={`binder${turning ? ` turning-${turning}` : ''}${single ? ' single' : ''}`} aria-live="polite">
            <BinderPage cards={pages[first] || []} number={first + 1} />
            {!single && <BinderPage cards={pages[first + 1] || []} number={first + 2} />}
          </div>
          <div className="binder-nav">
            <button type="button" className="btn btn-secondary" onClick={() => turn(-1)} disabled={spread === 0} aria-label="Pagina precedente">
              <i className="ph-bold ph-caret-left" />
            </button>
            <span>{spread + 1} / {spreads}</span>
            <button type="button" className="btn btn-secondary" onClick={() => turn(1)} disabled={spread >= spreads - 1} aria-label="Pagina successiva">
              <i className="ph-bold ph-caret-right" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
