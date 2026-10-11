import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
/** Carte chieste al server in una volta: dieci pagine (multiplo di PER_PAGE). */
const CHUNK = 90;

/** Una pagina del raccoglitore 2D: nove tasche, le carte che mancano sono sagome scure. */
function BinderSheet({ cards, number }) {
  // Pagina non ancora arrivata dal server: tasche vuote che pulsano.
  if (!cards) {
    return (
      <div className="binder-sheet loading" aria-busy="true">
        <div className="binder-pockets">
          {Array.from({ length: PER_PAGE }, (_, i) => <div key={i} className="binder-pocket empty-slot" />)}
        </div>
        <span className="binder-page-number">{number}</span>
      </div>
    );
  }
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
      <BinderSheet cards={pages[first] === undefined ? [] : pages[first]} number={first + 1} />
      {!single && <BinderSheet cards={pages[first + 1] === undefined ? [] : pages[first + 1]} number={first + 2} />}
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
  // Il raccoglitore arriva a blocchi di CHUNK carte: totale, possedute e i blocchi gia' caricati.
  const [book, setBook] = useState(null);
  const loading = useRef(new Set());
  const activeKey = useRef(null);
  const [turning, setTurning] = useState(null);
  const [single, setSingle] = useState(() => window.innerWidth < 900);
  const [flat, setFlat] = useState(false);
  const bookKey = setKey ? `set:${setKey}` : `source:${source}`;

  useEffect(() => {
    apiClient.get('/sets').then((res) => setSets(res.sets)).catch(() => setSets([]));
    const onResize = () => setSingle(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadChunk = useCallback((key, index) => {
    const id = `${key}#${index}`;
    if (loading.current.has(id)) return;
    loading.current.add(id);
    const [kind, value] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    collectionApi.binder({ [kind]: value, offset: index * CHUNK, limit: CHUNK }).then((res) => {
      // Risposta di un raccoglitore che non si guarda piu': si scarta.
      if (key !== activeKey.current) return;
      setBook((current) => {
        const chunks = new Map(current?.key === key ? current.chunks : []);
        chunks.set(index, res.cards || []);
        return { key, total: res.total, owned: res.owned, cardsTotal: res.cardsTotal ?? res.total, chunks };
      });
    }).catch(() => {
      loading.current.delete(id);
      setBook((current) => current || { key, total: 0, owned: 0, chunks: new Map() });
    });
  }, []);

  // Nuovo gioco o set: si ricomincia dal primo blocco.
  useEffect(() => {
    loading.current = new Set();
    activeKey.current = bookKey;
    loadChunk(bookKey, 0);
  }, [bookKey, loadChunk]);

  const cards = book && book.key === bookKey ? book : null;
  const total = cards?.total || 0;

  // Il tema segue il gioco scelto (per un set: il gioco delle sue carte).
  const firstCard = cards?.chunks.get(0)?.[0];
  const theme = useMemo(() => themeFor(setKey ? (firstCard?.source || 'original') : source), [setKey, firstCard, source]);

  // Pagine: quelle dei blocchi non ancora arrivati sono null (il libro le disegna vuote).
  const pages = useMemo(() => {
    const count = Math.max(1, Math.ceil(total / PER_PAGE));
    const out = Array.from({ length: count }, (_, i) => {
      const chunk = cards?.chunks.get(Math.floor((i * PER_PAGE) / CHUNK));
      if (!chunk) return null;
      const start = (i * PER_PAGE) % CHUNK;
      return chunk.slice(start, start + PER_PAGE);
    });
    // Nel libro le pagine vanno a coppie (davanti e dietro di ogni foglio).
    if (out.length % 2) out.push([]);
    return out;
  }, [cards, total]);
  const pagesKey = `${bookKey}:${total}`;
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

  // Cambiando vista si resta sulla stessa pagina. La vista piatta su schermo stretto mostra una
  // pagina alla volta, il libro 3D sempre due: si passa dal numero di pagina, non da quello della doppia.
  const toggleView = () => {
    const nextFlat = !flat;
    const nextPerSpread = nextFlat && single ? 1 : 2;
    // Finche' il raccoglitore carica conta la pagina dell'indirizzo: il numero di pagine non e' ancora noto.
    const current = cards ? spread : spreadParam;
    const next = Math.floor((current * perSpread) / nextPerSpread);
    setTurning(null);
    setFlat(nextFlat);
    setSpread(cards ? Math.min(next, Math.ceil(pages.length / nextPerSpread) - 1) : next);
  };

  // Si caricano i blocchi della doppia pagina mostrata e di quelle accanto (per sfogliare senza attese).
  useEffect(() => {
    if (!cards) return;
    const firstPage = Math.max(0, spread * perSpread - 2);
    const lastPage = Math.min(pages.length - 1, spread * perSpread + perSpread + 2);
    for (let page = firstPage; page <= lastPage; page += 1) {
      const index = Math.floor((page * PER_PAGE) / CHUNK);
      if (!cards.chunks.has(index) && index * CHUNK < total) loadChunk(bookKey, index);
    }
  }, [cards, spread, perSpread, pages.length, total, bookKey, loadChunk]);

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

  const owned = cards?.owned || 0;
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
        <button type="button" className="btn btn-secondary btn-small" onClick={toggleView}>
          <i className={`ph-fill ${flat ? 'ph-cube' : 'ph-squares-four'}`} /> {flat ? 'Vista 3D' : 'Vista piatta'}
        </button>
        <span className="binder-count">{owned} / {cards?.cardsTotal || total} carte</span>
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
          <i className="ph-fill ph-caret-left" />
        </button>
        <span>{spread + 1} / {spreads}</span>
        <button type="button" className="btn btn-secondary" onClick={() => turn(1)} disabled={spread >= spreads - 1} aria-label="Pagina successiva">
          <i className="ph-fill ph-caret-right" />
        </button>
      </div>
    </section>
  );
}
