import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient.js';
import { collectionApi } from '../../services/collectionApi.js';
import { useCardFilters } from '../../hooks/useCardFilters.js';
import CardFilterBar from '../../components/card/CardFilterBar.jsx';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';

const ERRORS = {
  gallery_self_vote: 'Non puoi votare la tua mostra.',
  gallery_not_found: 'Questa mostra non c\'e\' piu\'.',
  gallery_too_many: 'Al massimo 5 carte.',
  card_not_owned: 'Puoi esporre solo carte tue.'
};

function daysLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days} g ${hours} h` : `${Math.max(0, hours)} h`;
}

function CardStrip({ cards, onViewCard }) {
  return (
    <div className="gallery-strip">
      {cards.map((card) => (
        <button key={card.id} type="button" className="gallery-card" style={{ '--rarity-color': getRarityColor(card.rarity) }}
          onClick={() => onViewCard?.(card)} title={card.name}>
          <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
        </button>
      ))}
    </div>
  );
}

/**
 * Mostra delle collezioni: ognuno espone fino a 5 carte per la settimana, gli altri votano la
 * mostra piu' bella (un voto a testa, si puo' cambiare). Il lunedi' i primi tre vincono gold.
 */
export default function GalleryTab({ me, onViewCard }) {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(false);
  const [owned, setOwned] = useState(null);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiClient.get('/hotel/gallery').then(setData).catch(() => setNotice('Mostra non raggiungibile, riprova.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const startEditing = () => {
    setEditing(true);
    setPicked((data?.mine?.cards || []).map((c) => c.id));
    if (!owned) {
      collectionApi.getCollection({ owned: 'true' }).then((res) => setOwned(res.collection || [])).catch(() => setOwned([]));
    }
  };

  const filter = useCardFilters(owned, undefined, { sort: 'rarity' });
  const choices = filter.result.slice(0, 120);

  const run = (promise, ok) => {
    setBusy(true);
    promise.then((res) => { setData(res); if (ok) setNotice(ok); })
      .catch((err) => setNotice(ERRORS[err?.code] || 'Non riuscito, riprova.'))
      .finally(() => setBusy(false));
  };

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= (data?.maxCards || 5) ? p : [...p, id]));

  if (!data) return <p className="hotel-panel-hint">{notice || 'Carico la mostra…'}</p>;
  return (
    <div className="gallery-tab">
      <p className="hotel-panel-hint">
        Esponi le tue {data.maxCards} carte migliori e vota la mostra piu&apos; bella. Si chiude fra {daysLeft(data.endsAt)}:
        premi {data.prizes.join(' / ')} gold.
      </p>
      {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}

      {data.lastWinners?.winners?.length > 0 && (
        <p className="gallery-last"><i className="ph-fill ph-trophy" /> Settimana scorsa: {data.lastWinners.winners.map((w, i) => `${i + 1}. ${w.username} (${w.votes} voti)`).join(' · ')}</p>
      )}

      {editing ? (
        <section className="gallery-editor">
          <h4 className="events-sub">La tua mostra ({picked.length}/{data.maxCards})</h4>
          <CardFilterBar compact items={owned} {...filter} count={filter.result.length} />
          {!owned ? <p className="hotel-panel-hint">Carico la collezione…</p> : (
            <div className="gallery-picker">
              {choices.map((card) => (
                <button key={card.id} type="button" className={`gallery-card${picked.includes(card.id) ? ' picked' : ''}`}
                  style={{ '--rarity-color': getRarityColor(card.rarity) }} onClick={() => toggle(card.id)} title={card.name} aria-pressed={picked.includes(card.id)}>
                  <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <div className="gallery-actions">
            <button type="button" className="btn btn-primary btn-small" disabled={busy}
              onClick={() => { run(apiClient.put('/hotel/gallery', { cards: picked }), picked.length ? 'Mostra aggiornata!' : 'Mostra ritirata.'); setEditing(false); }}>
              Salva mostra
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditing(false)}>Annulla</button>
          </div>
        </section>
      ) : (
        <button type="button" className="btn btn-gold btn-small" onClick={startEditing}>
          <i className="ph-fill ph-frame-corners" /> {data.mine ? 'Cambia la tua mostra' : 'Allestisci la tua mostra'}
        </button>
      )}

      <h4 className="events-sub">Mostre della settimana</h4>
      {data.entries.length === 0 && <p className="hotel-panel-hint">Nessuna mostra ancora: allestisci la prima!</p>}
      <ol className="gallery-entries">
        {data.entries.map((entry, i) => {
          const mine = entry.userId === me?.id;
          const voted = data.myVote === entry.userId;
          return (
            <li key={entry.userId} className={mine ? 'mine' : ''}>
              <header>
                <span className="event-rank">{i + 1}</span>
                <strong>{entry.username}{mine ? ' (tu)' : ''}</strong>
                <span className="gallery-votes"><i className="ph-fill ph-heart" /> {entry.votes}</span>
                {!mine && (
                  <button type="button" className={`btn btn-small ${voted ? 'btn-gold' : 'btn-secondary'}`} disabled={busy || voted}
                    onClick={() => run(apiClient.post(`/hotel/gallery/${entry.userId}/vote`), `Hai votato la mostra di ${entry.username}!`)}>
                    {voted ? 'Votata' : 'Vota'}
                  </button>
                )}
              </header>
              <CardStrip cards={entry.cards} onViewCard={onViewCard} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
