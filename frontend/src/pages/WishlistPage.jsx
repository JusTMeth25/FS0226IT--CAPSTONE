import { useNavigate } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource.js';
import { extrasApi } from '../services/extrasApi.js';
import { getRarityColor, getRarityName, getSourceLabel, resolveCardImage } from '../utils/cardUtils.js';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

const WHERE_ICON = { market: 'ph-storefront', stall: 'ph-basket', npc: 'ph-user-sound' };

/**
 * Lista dei desideri: le carte che cerchi e dove si trovano adesso (mercato, banchetti dei
 * giocatori, vetrine degli NPC dell'hotel). Si aggiunge dal dettaglio di una carta.
 */
export default function WishlistPage() {
  const navigate = useNavigate();
  const { loading, data, reload } = useApiResource(() => extrasApi.wishlist(), []);

  const remove = (code) => extrasApi.removeWish(code).then(reload).catch(() => {});
  const go = (offer) => navigate(offer.where === 'market' ? '/marketplace' : '/hotel');

  return (
    <section className="wishlist-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-heart" /> Lista dei desideri</h2>
      <p className="page-subtitle">
        Le carte che cerchi. Quando una compare al mercato, sul banchetto di un giocatore o nella vetrina di un NPC te lo diciamo qui
        {data?.available ? <> — <strong className="wish-available-count">{data.available} disponibili adesso!</strong></> : '.'}
      </p>
      {loading ? <LoadingSpinner /> : !data?.wishes?.length ? (
        <EmptyState icon="ph-heart" title="Nessun desiderio"
          description="Apri il dettaglio di una carta (anche una che non hai) e premi 'Aggiungi ai desideri'."
          action={<button type="button" className="btn btn-primary" onClick={() => navigate('/binder')}><i className="ph-fill ph-book-open" /> Sfoglia il raccoglitore</button>} />
      ) : (
        <ul className="wish-list">
          {data.wishes.map(({ card, owned, offers }) => (
            <li key={card.id} className={`wish-item glass-panel${offers.length ? ' available' : ''}`} style={{ '--rarity-color': getRarityColor(card.rarity) }}>
              <button type="button" className="wish-card" onClick={() => navigate(`/card/${encodeURIComponent(card.id)}`)} aria-label={`Dettagli di ${card.name}`}>
                <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
              </button>
              <div className="wish-info">
                <strong>{card.name}</strong>
                <span className="wish-meta">{getSourceLabel(card.source)} · <span style={{ color: 'var(--rarity-color)' }}>{getRarityName(card.rarity)}</span></span>
                {owned && <span className="wish-owned"><i className="ph-fill ph-check-circle" /> Ce l&apos;hai gia&apos;</span>}
                {offers.length ? (
                  <ul className="wish-offers">
                    {offers.slice(0, 4).map((o, i) => (
                      <li key={i}>
                        <button type="button" className="wish-offer" onClick={() => go(o)}>
                          <i className={`ph-fill ${WHERE_ICON[o.where] || 'ph-map-pin'}`} /> {o.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <span className="wish-none">Per ora non la vende nessuno.</span>}
              </div>
              <button type="button" className="btn btn-secondary btn-small wish-remove" onClick={() => remove(card.id)} aria-label={`Togli ${card.name} dai desideri`}>
                <i className="ph ph-trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
