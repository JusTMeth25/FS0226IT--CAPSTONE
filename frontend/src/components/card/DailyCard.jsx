import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient.js';
import { getRarityColor, getRarityName, resolveCardImage } from '../../utils/cardUtils.js';

/**
 * Carta del giorno: la stessa per tutti, cambia a mezzanotte. La sfida e' vincere una battaglia
 * con quella carta in squadra; il premio arriva da solo alla fine della battaglia.
 */
export default function DailyCard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/cards/daily').then((res) => { if (!cancelled) setData(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Mentre arriva la risposta il pannello c'e' gia' (con un segnaposto), cosi' la home non
  // si ricompone quando compare la carta.
  if (!data) {
    return (
      <div className="glass-panel daily-card daily-card-loading" aria-busy="true">
        <h3 className="panel-title"><i className="ph-fill ph-calendar-star" /> Carta del giorno</h3>
        <div className="daily-card-body">
          <div className="daily-card-img"><div className="daily-card-skeleton" /></div>
        </div>
      </div>
    );
  }
  if (!data.card) return null;
  const { card } = data;
  return (
    <div className="glass-panel daily-card" style={{ '--rarity-color': getRarityColor(card.rarity) }}>
      <h3 className="panel-title"><i className="ph-fill ph-calendar-star" /> Carta del giorno</h3>
      <div className="daily-card-body">
        <button type="button" className="daily-card-img" onClick={() => navigate(`/card/${encodeURIComponent(card.id)}`)} aria-label={`Dettagli di ${card.name}`}>
          <img fetchPriority="high" decoding="async" src={resolveCardImage(card)} alt={card.name} />
        </button>
        <div className="daily-card-info">
          <strong>{card.name}</strong>
          <span className="daily-card-rarity">{getRarityName(card.rarity)}</span>
          <p>{data.challenge}</p>
          <p className="daily-card-reward"><i className="ph-fill ph-coin" /> {data.reward} gold</p>
          {data.claimed ? (
            <span className="daily-card-done"><i className="ph-fill ph-seal-check" /> Sfida vinta oggi!</span>
          ) : data.owned ? (
            <button type="button" className="btn btn-primary btn-small" onClick={() => navigate('/battle')}>
              <i className="ph-fill ph-sword" /> Vai in battaglia
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => navigate('/packs')}>
              <i className="ph-fill ph-gift" /> Non ce l&apos;hai: cercala nei pacchetti
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
