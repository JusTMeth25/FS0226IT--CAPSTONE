import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collectionApi } from '../services/collectionApi.js';
import { apiClient } from '../services/apiClient.js';
import { SOURCE_LABELS, getRarityColor, resolveCardImage } from '../utils/cardUtils.js';
import { coverImage, themeFor } from '../components/binder/binderThemes.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import ThreeGate from '../components/three/ThreeGate.jsx';

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
            <div key={card.id} className={`binder-pocket${card.owned ? ' owned' : ' missing'}${card.foil > 0 ? ' is-foil' : ''}`} style={{ '--rarity-color': getRarityColor(card.rarity) }}>
              {card.owned ? (
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
  const [source, setSource] = useState('original');
  const [setKey, setSetKey] = useState('');
  const [sets, setSets] = useState([]);
  const [cards, setCards] = useState(null);
  const [spread, setSpread] = useState(0);
  const [turning, setTurning] = useState(null);
  const [single, setSingle] = useState(() => window.innerWidth < 900);
  const [flat, setFlat] = useState(false);
  const swipe = useRef(null);

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

  const turn = useCallback((dir) => {
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
  }, [spread, spreads, turning, flat]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight') turn(1);
      if (e.key === 'ArrowLeft') turn(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

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
        <button type="button" className="btn btn-secondary btn-small" onClick={() => { setFlat((f) => !f); setSpread(0); }}>
          <i className={`ph-fill ${flat ? 'ph-cube' : 'ph-squares-four'}`} /> {flat ? 'Vista 3D' : 'Vista piatta'}
        </button>
        <span className="binder-count">{owned} / {cards?.length || 0} carte</span>
      </div>
      <p className="binder-title"><img src={coverImage(theme)} alt="" /> {theme.title}</p>

      {!cards ? <LoadingSpinner /> : flat ? flatView : (
        <div
          className="binder-3d-wrap"
          onPointerDown={(e) => { swipe.current = e.clientX; }}
          onPointerUp={(e) => {
            if (swipe.current === null) return;
            const dx = e.clientX - swipe.current;
            swipe.current = null;
            if (Math.abs(dx) > 60) turn(dx < 0 ? 1 : -1);
          }}
        >
          <ThreeGate fallback={flatView}>
            <BinderBook3D pages={pages} theme={theme} spread={spread} pagesKey={pagesKey} onCard={openCard} onSettled={() => setTurning(null)} />
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
