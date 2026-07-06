import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { CARDS, getArtistClasses } from '../data/cards.js';
import { RARITIES, RARITY_ORDER, getTotalScore } from '../utils/cardUtils.js';
import { dedupeCollection } from '../utils/collectionUtils.js';
import CardTile from '../components/card/CardTile.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

export default function CollectionPage() {
  const { collection, stats } = useGame();
  const navigate = useNavigate();

  const [classFilter, setClassFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const artistClasses = useMemo(() => getArtistClasses(), []);
  const uniqueCount = useMemo(() => new Set(collection.map((c) => c.id)).size, [collection]);

  const filteredCards = useMemo(() => {
    let unique = dedupeCollection(collection);

    if (classFilter) unique = unique.filter((c) => c.artistClass === classFilter);
    if (rarityFilter) unique = unique.filter((c) => c.rarity === rarityFilter);

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
  }, [collection, classFilter, rarityFilter, sortBy, sortDir]);

  function resetFilters() {
    setClassFilter('');
    setRarityFilter('');
    setSortBy('date');
    setSortDir('desc');
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
          <span className="collection-stat-value">{CARDS.length > 0 ? Math.round((uniqueCount / CARDS.length) * 100) : 0}%</span>
          <span className="collection-stat-label">VinylDex</span>
        </div>
      </div>

      <div className="rarity-counts glass-panel">
        <div className="rarity-counts-row">
          {Object.entries(RARITIES).map(([key, r]) => (
            <div className="rarity-count-item" key={key} onClick={() => setRarityFilter(key)}>
              <span className="rarity-count-value" style={{ color: r.color }}>{stats[`${key}Count`] || 0}</span>
              <span className="rarity-count-label">{r.name}</span>
            </div>
          ))}
          <div className="rarity-count-item" onClick={() => setRarityFilter('')}>
            <span className="rarity-count-value">{collection.length}</span>
            <span className="rarity-count-label">Totale</span>
          </div>
        </div>
      </div>

      <div className="collection-filters glass-panel">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Classe</label>
            <select className="filter-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">Tutte le Classi</option>
              {artistClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Rarità</label>
            <select className="filter-select" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
              <option value="">Tutte le Rarità</option>
              {Object.entries(RARITIES).map(([key, r]) => <option key={key} value={key}>{r.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Ordina per</label>
            <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date">Data ottenimento</option>
              <option value="name">Nome</option>
              <option value="rarity">Rarità</option>
              <option value="stats">Stats totali</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Ordine</label>
            <button className="btn btn-secondary btn-small" onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
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
    </section>
  );
}
