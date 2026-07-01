import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useGame } from '../hooks/useGame.js';
import { useApiResource } from '../hooks/useApiResource.js';
import { marketApi } from '../services/marketApi.js';
import { getRarityColor, resolveCardImage } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

function uniqueOwnedCards(collection) {
  const counts = new Map();
  collection.forEach((c) => counts.set(c.id, (counts.get(c.id) || 0) + 1));
  const seen = new Set();
  const result = [];
  [...collection].reverse().forEach((c) => {
    if (!seen.has(c.id)) { seen.add(c.id); result.push({ ...c, owned: counts.get(c.id) }); }
  });
  return result;
}

export default function MarketplacePage() {
  const { isAuthenticated, user } = useAuth();
  const game = useGame();
  const { loading, error, data, reload } = useApiResource(() => marketApi.getListings(), []);
  const [actionError, setActionError] = useState(null);
  const [sellForm, setSellForm] = useState({ cardId: '', quantity: 1, price: 10 });

  const ownedCards = useMemo(() => uniqueOwnedCards(game.collection), [game.collection]);
  const listings = data?.listings || [];

  async function handleBuy(listing) {
    setActionError(null);
    try {
      await marketApi.buyListing(listing.id, 1);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleCancel(listing) {
    setActionError(null);
    try {
      await marketApi.cancelListing(listing.id);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleSell(e) {
    e.preventDefault();
    if (!sellForm.cardId) return;
    setActionError(null);
    try {
      await marketApi.createListing(sellForm.cardId, Number(sellForm.quantity), Number(sellForm.price));
      setSellForm({ cardId: '', quantity: 1, price: 10 });
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <section className="market-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-storefront" /> Mercato</h2>
      <p className="page-subtitle">Compra e vendi carte usando solo gold. Nessun acquisto con denaro reale.</p>

      {isAuthenticated && (
        <div className="glass-panel">
          <h3 className="panel-title"><i className="ph-fill ph-tag" /> Vendi una carta</h3>
          {ownedCards.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Non possiedi ancora carte da vendere.</p>
          ) : (
            <form className="admin-form-row" onSubmit={handleSell}>
              <div className="filter-group">
                <label className="filter-label">Carta</label>
                <select className="filter-select" value={sellForm.cardId} onChange={(e) => setSellForm((f) => ({ ...f, cardId: e.target.value }))}>
                  <option value="">Seleziona…</option>
                  {ownedCards.map((c) => <option key={c.id} value={c.id}>{c.name} (x{c.owned})</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">Quantità</label>
                <input className="ai-input" type="number" min="1" value={sellForm.quantity} onChange={(e) => setSellForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="filter-group">
                <label className="filter-label">Prezzo (gold/unità)</label>
                <input className="ai-input" type="number" min="1" value={sellForm.price} onChange={(e) => setSellForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary">Metti in vendita</button>
            </form>
          )}
        </div>
      )}

      {actionError && <div className="auth-message auth-message-error">{actionError}</div>}

      {loading ? (
        <LoadingSpinner label="Carico il mercato…" />
      ) : error ? (
        <EmptyState
          icon="ph-plug"
          title="Mercato non raggiungibile"
          description="Il servizio di marketplace non è al momento disponibile. Riprova più tardi."
          action={<button className="btn btn-secondary" onClick={reload}><i className="ph-fill ph-arrows-clockwise" /> Riprova</button>}
        />
      ) : listings.length === 0 ? (
        <EmptyState icon="ph-storefront" title="Nessun annuncio" description="Al momento non ci sono carte in vendita nel mercato." />
      ) : (
        <div className="listing-list">
          {listings.map((listing) => (
            <div className="listing-item glass-panel" key={listing.id}>
              <div className="listing-item-art"><img src={resolveCardImage(listing.card)} alt={listing.card?.name} /></div>
              <div className="listing-item-info">
                <span className="listing-item-name" style={{ color: getRarityColor(listing.card?.rarity) }}>{listing.card?.name}</span>
                <span className="listing-item-meta">Venditore: {listing.seller?.username} · Quantità: {listing.quantity}</span>
              </div>
              <span className="listing-item-price"><i className="ph-fill ph-coin" /> {listing.pricePerUnit}</span>
              <div className="listing-item-actions">
                {listing.seller?.id === user?.id ? (
                  <button className="btn btn-danger btn-small" onClick={() => handleCancel(listing)}>Rimuovi</button>
                ) : (
                  <button className="btn btn-primary btn-small" onClick={() => handleBuy(listing)} disabled={!isAuthenticated}>Compra</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
