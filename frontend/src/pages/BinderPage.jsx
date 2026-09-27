import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collectionApi } from '../services/collectionApi.js';
import { apiClient } from '../services/apiClient.js';
import { useFilterParams } from '../hooks/useFilterParams.js';
import { SOURCE_LABELS, getRarityColor, resolveCardImage } from '../utils/cardUtils.js';
import { coverImage, themeFor } from '../components/binder/binderThemes.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import ThreeGate from '../components/three/ThreeGate.jsx';
import GradedSlab from '../components/card/GradedSlab.jsx';

// Il libro 3D porta con se' three.js: si scarica solo quando si apre il raccoglitore.
const BinderBook3D = lazy(() => import('../components/binder/BinderBook3D.jsx'));

const PER_PAGE = 9;
const TURN_MS = 320;

/** Una pagina del raccoglitore 2D: nove tasche, le carte che mancano sono sagome scure. */
function BinderSheet({ cards, number }) {
  return (
    <div className="binder-sheet">
      <div className="binder-pockets">
        {Array.from({ length: PER_PAGE }, (_, i) => {
          const card = cards[i];
          if (!card) return <div key={i} className="binder-pocket empty-slot" />;
          return (
            <div key={card.id} className={`binder-pocket${card.owned ? ' owned' : ' missing'}${card.foil > 0 && !(card.grade > 0) ? ' is-foil' : ''}${card.owned && card.grade > 0 ? ' graded' : ''}`} style={{ '--rarity-color': getRarityColor(card.rarity) }}>
              {card.owned && card.grade > 0 ? (
                <Link to={`/card/${encodeURIComponent(card.id)}`} title={card.name} className="binder-slab-link">
                  <GradedSlab card={card} size="small" />
                </Link>
              ) : card.owned ? (
                <Link to={`/card/${encodeURIComponent(card.id)}`} title={card.name}>
                  <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
                </Link>
              ) : (
                <Link to={`/card/${encodeURIComponent(card.id)}`} title={`${card.name} (manca)`}>
                  <img src={resolveCardImage(card)} alt={`${card.name} (manca)`} loading="lazy" />
                  <small>{card.number || '?'}</small>
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <span className="binder-page-number">{number}</span>
    </div>
  );
}

/** Raccoglitore 2D (senza WebGL o su richiesta), con i colori e la copertina del gioco. */
function FlatBinder({ pages, spread, single, turning }) {
  const first = spread * (single ? 1 : 2);
  return (
    <div className={`binder${turning ? ` turning-${turning}` : ''}${single ? ' single' : ''}`} aria-live="polite">
      <BinderSheet cards={pages[first] || []} number={first + 1} />
      {!single && <BinderSheet cards={pages[first + 1] || []} number={first + 2} />}
    </div>
  );
}

/**
 * Raccoglitore: la collezione come un album vero, gioco per gioco (ognuno con la sua grafica) o
 * set per set. In 3D il libro si apre e le pagine si sfogliano; senza WebGL resta la vista 2D.
 */
export default function BinderPage() {
  const navigate = useNavigate();
  // Gioco e set stanno nell'indirizzo: tornando indietro dal dettaglio di una carta si riapre
  // lo stesso raccoglitore invece di quello di VinylDex.
  const { getParam, setParam } = useFilterParams();
  const source = getParam('source', 'original');
  const setKey = getParam('set');
  const setSource = (value) => setParam('source', value === 'original' ? '' : value);
  const setSetKey = (value) => setParam('set', value);
  const spreadParam = Number(getParam('p', '0')) || 0;
  const setSpread = (value) => setParam('p', value > 0 ? String(value) : '');
  const [sets, setSets] = useState([]);
  const [cards, setCards] = useState(null);
  const [turning, setTurning] = useState(null);
  const [single, setSingle] = useState(() => window.innerWidth < 900);
  const [flat, setFlat] = useState(false);

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
        if (!cancelled) setCards(list);
      });
    } else {
      collectionApi.getCollection({ source }).then((res) => {
        if (cancelled) return;
        const list = [...(res.collection || [])].sort((a, b) => (a.setCode || '').localeCompare(b.setCode || '')
          || String(a.number || '').localeCompare(String(b.number || ''), undefined, { numeric: true })
          || a.name.localeCompare(b.name));
        setCards(list);
      }).catch(() => setCards([]));
    }
    return () => { cancelled = true; };
  }, [source, setKey, sets]);

  // Il tema segue il gioco scelto (per un set: il gioco delle sue carte).
  const theme = useMemo(() => themeFor(setKey ? (cards?.[0]?.source || 'original') : source), [setKey, cards, source]);

  const pages = useMemo(() => {
    const list = cards || [];
    const out = Array.from({ length: Math.max(1, Math.ceil(list.length / PER_PAGE)) }, (_, i) => list.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
    // Nel libro le pagine vanno a coppie (davanti e dietro di ogni foglio).
    if (out.length % 2) out.push([]);
    return out;
  }, [cards]);
  const pagesKey = `${setKey || source}:${cards?.length || 0}`;
  const perSpread = flat && single ? 1 : 2;
  const spreads = Math.max(1, Math.ceil(pages.length / perSpread));
  // Anche la pagina sta nell'indirizzo; se il raccoglitore si e' accorciato si resta nell'ultima.
  const spread = Math.min(spreadParam, spreads - 1);

  const turn = (dir) => {
    if (turning) return;
    const next = spread + dir;
    if (next < 0 || next >= spreads) return;
    if (flat) {
      setTurning(dir > 0 ? 'next' : 'prev');
      setTimeout(() => setSpread(next), TURN_MS);
      setTimeout(() => setTurning(null), TURN_MS * 2);
    } else {
      setTurning(dir > 0 ? 'next' : 'prev');
      setSpread(next);
    }
  };

  // I tasti chiamano sempre l'ultima versione di turn senza riagganciare l'ascoltatore.
  const turnRef = useRef(turn);
  useEffect(() => { turnRef.current = turn; });
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight') turnRef.current(1);
      if (e.key === 'ArrowLeft') turnRef.current(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Anche le carte che mancano si aprono: il dettaglio dice dove trovarle.
  const openCard = (card) => navigate(`/card/${encodeURIComponent(card.id)}`);

  const owned = (cards || []).filter((c) => c.owned).length;
  const flatView = <FlatBinder pages={pages} spread={spread} single={single} turning={turning} />;
  return (
    <section className="binder-page" style={{ '--binder-accent': theme.accent, '--binder-page': theme.page, '--binder-pocket': theme.pocket, '--binder-cover': `url(${coverImage(theme)})` }}>
      <h2 className="section-title text-gradient"><i className="ph-fill ph-book-open" /> Raccoglitore</h2>
      <div className="binder-controls">
        <label>
          Gioco
          <select value={setKey ? '' : source} onChange={(e) => { setSetKey(''); setSpread(0); setSource(e.target.value); }}>
            {Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          oppure set
          <select value={setKey} onChange={(e) => { setSpread(0); setSetKey(e.target.value); }}>
            <option value="">—</option>
            {sets.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => { setFlat((f) => !f); setSpread(0); }}>
          <i className={`ph-fill ${flat ? 'ph-cube' : 'ph-squares-four'}`} /> {flat ? 'Vista 3D' : 'Vista piatta'}
        </button>
        <span className="binder-count">{owned} / {cards?.length || 0} carte</span>
      </div>
      <p className="binder-title"><img src={coverImage(theme)} alt="" /> {theme.title}</p>

      {!cards ? <LoadingSpinner /> : flat ? flatView : (
        // Nel libro 3D il trascinamento gira il libro e sfoglia dagli angoli (vedi BinderBook3D).
        <div className="binder-3d-wrap">
          <ThreeGate fallback={flatView}>
            <BinderBook3D pages={pages} theme={theme} spread={spread} pagesKey={pagesKey} onCard={openCard} onSettled={() => setTurning(null)}
              onTurned={(next) => setSpread(next)} />
          </ThreeGate>
        </div>
      )}
      <div className="binder-nav">
        <button type="button" className="btn btn-secondary" onClick={() => turn(-1)} disabled={spread === 0} aria-label="Pagina precedente">
          <i className="ph-bold ph-caret-left" />
        </button>
        <span>{spread + 1} / {spreads}</span>
        <button type="button" className="btn btn-secondary" onClick={() => turn(1)} disabled={spread >= spreads - 1} aria-label="Pagina successiva">
          <i className="ph-bold ph-caret-right" />
        </button>
      </div>
    </section>
  );
}
