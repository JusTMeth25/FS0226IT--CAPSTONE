import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useFilterParams } from '../hooks/useFilterParams.js';
import { CARDS, getArtistClasses } from '../data/cards.js';
import { RARITIES, RARITY_ORDER, SOURCE_LABELS, formatMarketPrice, getRarityIcon, getSourceLabel, getTotalScore } from '../utils/cardUtils.js';
import { dedupeCollection, getCollectionValue } from '../utils/collectionUtils.js';
import CardTile from '../components/card/CardTile.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ScrollToTopButton from '../components/common/ScrollToTopButton.jsx';

export default function CollectionPage() {
  const { collection, catalogSize, stats } = useGame();
  const navigate = useNavigate();
  // Per gli utenti autenticati il totale reale del catalogo (tutte le fonti) arriva dal server;
  // in modalità ospite l'unico universo possibile resta il catalogo statico locale delle carte originali.
  const totalCatalogCards = catalogSize ?? CARDS.length;

  const { getParam, setParam, resetParams } = useFilterParams();
  const classFilter = getParam('class');
  const rarityFilter = getParam('rarity');
  const sourceFilter = getParam('source');
  const sortBy = getParam('sort', 'date');
  const sortDir = getParam('dir', 'desc');

  const artistClasses = useMemo(() => getArtistClasses(), []);
  const uniqueCount = useMemo(() => new Set(collection.map((c) => c.id)).size, [collection]);
  const availableSources = useMemo(() => {
    const present = new Set(collection.map((c) => c.source).filter(Boolean));
    return Object.keys(SOURCE_LABELS).filter((s) => present.has(s));
  }, [collection]);

  const filteredCards = useMemo(() => {
    let unique = dedupeCollection(collection);

    if (classFilter) unique = unique.filter((c) => c.artistClass === classFilter);
    if (rarityFilter) unique = unique.filter((c) => c.rarity === rarityFilter);
    if (sourceFilter) unique = unique.filter((c) => c.source === sourceFilter);

    unique.sort((a, b) => {
      let cmp;
      switch (sortBy) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'rarity': cmp = (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0); break;
        case 'stats': cmp = getTotalScore(b) - getTotalScore(a); break;
        case 'date':
        default: cmp = new Date(b.obtainedAt || 0) - new Date(a.obtainedAt || 0);
      }
      return sortDir === 'desc' ? cmp : -cmp;
    });

    return unique;
  }, [collection, classFilter, rarityFilter, sourceFilter, sortBy, sortDir]);

  // Con un filtro attivo il valore riguarda solo le carte mostrate; senza filtri e' quello
  // dell'intera collezione. L'ordinamento non conta: cambia l'ordine, non quali carte ci sono.
  const hasFilters = Boolean(classFilter || rarityFilter || sourceFilter);
  const collectionValue = useMemo(
    () => getCollectionValue(hasFilters ? filteredCards : collection),
    [hasFilters, filteredCards, collection]
  );

  function resetFilters() {
    resetParams(['class', 'rarity', 'source', 'sort', 'dir']);
  }

  return (
    <section className="collection-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-cards" /> La Mia Collezione</h2>

      <div className="collection-stats glass-panel">
        <div className="collection-stat">
          <span className="collection-stat-value">{uniqueCount}</span>
          <span className="collection-stat-label">Carte Uniche</span>
        </div>
        <div className="collection-stat">
          <span className="collection-stat-value">{collection.length}</span>
          <span className="collection-stat-label">Totale</span>
        </div>
        <div className="collection-stat">
          <span className="collection-stat-value">{totalCatalogCards > 0 ? Math.round((uniqueCount / totalCatalogCards) * 100) : 0}%</span>
          <span className="collection-stat-label">VinylDex</span>
        </div>
        <div
          className="collection-stat collection-stat-value-worth"
          title={collectionValue.unpricedCount > 0
            ? `Stima dai prezzi di mercato${hasFilters ? ' delle carte filtrate' : ''}. ${collectionValue.unpricedCount} carte senza prezzo (VinylDex, Lorcana, Gundam, Riftbound) non sono incluse.`
            : `Stima dai prezzi di mercato delle carte ${hasFilters ? 'filtrate' : 'possedute'}.`}
        >
          <span className="collection-stat-value">{formatMarketPrice(collectionValue.total) || '—'}</span>
          <span className="collection-stat-label">{hasFilters ? 'Valore filtrato' : 'Valore stimato'}</span>
        </div>
      </div>

      <div className="rarity-counts glass-panel">
        <div className="rarity-counts-row">
          {Object.entries(RARITIES).map(([key, r]) => (
            <div className="rarity-count-item" key={key} onClick={() => setParam('rarity', key)}>
              <span className="rarity-count-icon"><img src={getRarityIcon(key)} alt="" /></span>
              <span className="rarity-count-label">{r.name}</span>
              <span className="rarity-count-value" style={{ color: r.color }}>{stats[`${key}Count`] || 0}</span>
            </div>
          ))}
          <div className="rarity-count-item" onClick={() => setParam('rarity', '')}>
            <span className="rarity-count-icon"><img src="/total.svg" alt="" /></span>
            <span className="rarity-count-label">Totale</span>
            <span className="rarity-count-value">{collection.length}</span>
          </div>
        </div>
      </div>

      <div className="collection-filters glass-panel">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Classe</label>
            <select className="filter-select" value={classFilter} onChange={(e) => setParam('class', e.target.value)}>
              <option value="">Tutte le Classi</option>
              {artistClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Rarità</label>
            <select className="filter-select" value={rarityFilter} onChange={(e) => setParam('rarity', e.target.value)}>
              <option value="">Tutte le Rarità</option>
              {Object.entries(RARITIES).map(([key, r]) => <option key={key} value={key}>{r.name}</option>)}
            </select>
          </div>
          {availableSources.length > 1 && (
            <div className="filter-group">
              <label className="filter-label">Fonte</label>
              <select className="filter-select" value={sourceFilter} onChange={(e) => setParam('source', e.target.value)}>
                <option value="">Tutte le Fonti</option>
                {availableSources.map((s) => <option key={s} value={s}>{getSourceLabel(s)}</option>)}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label className="filter-label">Ordina per</label>
            <select className="filter-select" value={sortBy} onChange={(e) => setParam('sort', e.target.value)}>
              <option value="date">Data ottenimento</option>
              <option value="name">Nome</option>
              <option value="rarity">Rarità</option>
              <option value="stats">Stats totali</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Ordine</label>
            <button className="btn btn-secondary btn-small" onClick={() => setParam('dir', sortDir === 'desc' ? 'asc' : 'desc')}>
              {sortDir === 'desc' ? <><i className="ph-fill ph-sort-descending" /> Decrescente</> : <><i className="ph-fill ph-sort-ascending" /> Crescente</>}
            </button>
          </div>
        </div>
      </div>

      {uniqueCount === 0 ? (
        <EmptyState
          title="Collezione vuota"
          description="Non hai ancora nessuna carta."
          action={<button className="btn btn-primary" onClick={() => navigate('/packs')}><i className="ph-fill ph-vinyl-record" /> Apri il Primo Pacchetto</button>}
        />
      ) : filteredCards.length === 0 ? (
        <EmptyState
          icon="ph-magnifying-glass"
          title="Nessun risultato"
          description="Nessuna carta corrisponde ai filtri selezionati."
          action={<button className="btn btn-secondary" onClick={resetFilters}><i className="ph-fill ph-arrows-clockwise" /> Resetta Filtri</button>}
        />
      ) : (
        <div className="collection-grid">
          {filteredCards.map((card) => (
            <CardTile key={card.id} card={card} quantity={card.quantity} onClick={() => navigate(`/card/${card.id}`)} />
          ))}
        </div>
      )}

      <ScrollToTopButton />
    </section>
  );
}
