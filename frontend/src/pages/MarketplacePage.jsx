import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useGame } from '../hooks/useGame.js';
import { useApiResource } from '../hooks/useApiResource.js';
import { marketApi } from '../services/marketApi.js';
import { apiClient } from '../services/apiClient.js';
import { getRarityColor, resolveCardImage } from '../utils/cardUtils.js';
import { dedupeCollection } from '../utils/collectionUtils.js';
import { useCardFilters } from '../hooks/useCardFilters.js';
import CardFilterBar from '../components/card/CardFilterBar.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import DealBanner from '../components/trade/DealBanner.jsx';
import { newDeal } from '../components/trade/newDeal.js';
import '../styles/pages/social-phantom.css';
import '../styles/pages/social-market.css';

function uniqueOwnedCards(collection) {
  return dedupeCollection(collection).map((c) => ({ ...c, owned: c.quantity }));
}

export default function MarketplacePage() {
  const { isAuthenticated, user } = useAuth();
  const game = useGame();
  const { loading, error, data, reload } = useApiResource(() => marketApi.getListings(), []);
  const [actionError, setActionError] = useState(null);
  const [sellForm, setSellForm] = useState({ cardId: '', quantity: 1, price: 10 });
  // Esito dell'ultimo acquisto o vendita, per il banner del "colpo riuscito".
  const [deal, setDeal] = useState(null);
  const clearDeal = useCallback(() => setDeal(null), []);

  const ownedCards = useMemo(() => uniqueOwnedCards(game.collection), [game.collection]);
  const sellFilter = useCardFilters(ownedCards, undefined, { sort: 'name', dir: 'asc' });
  const listings = data?.listings || [];
  // Borsa del mercato: prezzo medio fra giocatori, per capire se un annuncio e' un affare.
  const [averages, setAverages] = useState({});
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    apiClient.get('/market/averages').then((res) => { if (!cancelled) setAverages(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, data]);

  async function handleBuy(listing) {
    setActionError(null);
    try {
      await marketApi.buyListing(listing.id, 1);
      setDeal(newDeal('Affare fatto!', `${listing.card?.name || 'La carta'} è tua per ${listing.pricePerUnit} gold.`));
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
      const sold = ownedCards.find((c) => String(c.id) === String(sellForm.cardId));
      setDeal(newDeal('In vetrina!', `${sold?.name || 'La carta'} ×${sellForm.quantity} in vendita a ${sellForm.price} gold l'una.`));
      setSellForm({ cardId: '', quantity: 1, price: 10 });
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <section className="market-page sp-page">
      <header className="sp-head">
        <PhantomTitle as="h2" text="Mercato" />
        <p className="sp-sub">Compra e vendi carte usando solo gold. Nessun acquisto con denaro reale.</p>
      </header>
      <DealBanner deal={deal} onDone={clearDeal} />

      {isAuthenticated && (
        <div className="glass-panel sm-sell">
          <h3 className="panel-title"><i className="ph-fill ph-tag" /> Vendi una carta</h3>
          {ownedCards.length === 0 ? (
            <p className="sm-note">Non possiedi ancora carte da vendere.</p>
          ) : (
            <>
              <CardFilterBar items={ownedCards} {...sellFilter} count={sellFilter.result.length} />
              <form className="admin-form-row sm-sell-form" onSubmit={handleSell}>
                <div className="filter-group">
                  <label className="filter-label" htmlFor="sm-card">Carta</label>
                  <select id="sm-card" className="filter-select" value={sellForm.cardId} onChange={(e) => setSellForm((f) => ({ ...f, cardId: e.target.value }))}>
                    <option value="">Seleziona…</option>
                    {sellFilter.result.map((c) => <option key={c.id} value={c.id}>{c.name} (x{c.owned})</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label" htmlFor="sm-qty">Quantità</label>
                  <input id="sm-qty" className="ai-input" type="number" min="1" value={sellForm.quantity} onChange={(e) => setSellForm((f) => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div className="filter-group">
                  <label className="filter-label" htmlFor="sm-price">Prezzo (gold/unità)</label>
                  <input id="sm-price" className="ai-input" type="number" min="1" value={sellForm.price} onChange={(e) => setSellForm((f) => ({ ...f, price: e.target.value }))} />
                </div>
                <button type="submit" className="btn btn-primary sm-sell-btn" disabled={!sellForm.cardId}><i className="ph-fill ph-tag" /> Metti in vendita</button>
              </form>
            </>
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
        <EmptyState
          icon="ph-storefront"
          title="Bancarelle vuote"
          description={isAuthenticated && ownedCards.length > 0
            ? 'Al momento nessuno vende carte. Apri tu il mercato: scegli una carta qui sopra e mettila in vendita.'
            : 'Al momento non ci sono carte in vendita nel mercato.'}
        />
      ) : (
        <div className="listing-list sm-list">
          <p className="sm-count">{listings.length === 1 ? '1 annuncio' : `${listings.length} annunci`}</p>
          {listings.map((listing) => (
            <div className="listing-item glass-panel" key={listing.id}>
              <div className="listing-item-art"><img loading="lazy" decoding="async" src={resolveCardImage(listing.card)} alt={listing.card?.name} /></div>
              <div className="listing-item-info">
                <span className="listing-item-name" style={{ color: getRarityColor(listing.card?.rarity) }}>{listing.card?.name}</span>
                <span className="listing-item-meta">Venditore: {listing.seller?.username} · Quantità: {listing.quantity}</span>
                {averages[listing.card?.id] > 0 && (
                  <span className={`listing-item-average${listing.pricePerUnit <= averages[listing.card.id] ? ' good' : ''}`}>
                    <i className="ph-fill ph-scales" /> Media fra giocatori: {averages[listing.card.id]} gold
                    {listing.pricePerUnit <= averages[listing.card.id] ? ' · affare!' : ''}
                  </span>
                )}
              </div>
              <span className="listing-item-price"><i className="ph-fill ph-coin" aria-hidden="true" /> {listing.pricePerUnit}<small> gold</small></span>
              <div className="listing-item-actions">
                {listing.seller?.id === user?.id ? (
                  <button className="btn btn-danger btn-small" onClick={() => handleCancel(listing)}>Rimuovi</button>
                ) : (
                  <button className="btn btn-primary btn-small" onClick={() => handleBuy(listing)} disabled={!isAuthenticated}><i className="ph-fill ph-shopping-cart-simple" /> Compra</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
