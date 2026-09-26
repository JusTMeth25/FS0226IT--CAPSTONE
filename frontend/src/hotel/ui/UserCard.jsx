import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient.js';
import { getRarityColor } from '../../utils/cardUtils.js';
import AvatarPreview from './AvatarPreview.jsx';
import PhotoGallery from '../../components/common/PhotoGallery.jsx';

const BADGE_ICONS = {
  collector1: 'ph-cards', collector2: 'ph-cards-three', collector3: 'ph-crown-simple',
  legend: 'ph-star-four', level1: 'ph-trend-up', level2: 'ph-medal', level3: 'ph-medal-military',
  fighter: 'ph-sword', champion: 'ph-trophy'
};

/**
 * Scheda di un giocatore, aperta cliccando il suo avatar: aspetto, livello, rispetti,
 * distintivi e la carta migliore. Da qui si sussurra, si da' rispetto, si propone uno
 * scambio, si visita la sua stanza, lo si sfida.
 */
export default function UserCard({ user, look, isMe, isOwner, respectVersion, onClose, onWhisper, onRespect, onKick, onVisit, onChallenge, onViewCard, onAddFriend }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get(`/hotel/profile/${user.id}`)
      .then((res) => { if (!cancelled) setProfile(res); })
      .catch(() => { if (!cancelled) setProfile(null); });
    return () => { cancelled = true; };
  }, [user.id, respectVersion]);

  const canRespect = profile && !isMe && !profile.respectedToday && profile.respectsLeft > 0;

  return (
    <div className="hotel-panel hotel-user-card" role="dialog" aria-label={`Profilo di ${user.username}`}>
      <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      <div className="hotel-user-card-top">
        <AvatarPreview look={look || user.look} scale={1} />
        <div className="hotel-user-card-info">
          <strong>{user.username}</strong>
          <span>Livello {profile?.level ?? user.level}</span>
          {profile && (
            <span className="hotel-user-stats">
              <span title="Rispetti ricevuti"><i className="ph-fill ph-heart" /> {profile.respects}</span>
              <span title="Carte diverse"><i className="ph-fill ph-cards" /> {profile.uniqueCards}</span>
              <span title="Battaglie vinte"><i className="ph-fill ph-sword" /> {profile.battlesWon}</span>
            </span>
          )}
          {profile?.badges?.length > 0 && (
            <div className="hotel-badges">
              {profile.badges.map((b) => (
                <span key={b.code} className={`hotel-badge hotel-badge-${b.code}`} title={`${b.name}: ${b.description}`}>
                  <i className={`ph-fill ${BADGE_ICONS[b.code] || (b.icon ? `ph-${b.icon}` : 'ph-seal-check')}`} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {profile?.bestCard && (
        <button type="button" className="hotel-best-card" style={{ '--rarity-color': getRarityColor(profile.bestCard.rarity) }} onClick={() => onViewCard(profile.bestCard)}>
          <i className="ph-fill ph-star" /> Carta migliore: <strong>{profile.bestCard.name}</strong>
        </button>
      )}

      {profile?.id && <PhotoGallery userId={profile.id} compact />}

      {!isMe && (
        <div className="hotel-user-actions">
          <button type="button" className="btn btn-secondary btn-small" onClick={onWhisper}>
            <i className="ph-fill ph-ear" /> Sussurra
          </button>
          <button type="button" className="btn btn-secondary btn-small" disabled={!canRespect} onClick={onRespect}
            title={profile?.respectedToday ? 'Gli hai gia\' dato rispetto oggi' : `Te ne restano ${profile?.respectsLeft ?? 0} oggi`}>
            <i className="ph-fill ph-heart" /> Rispetta
          </button>
          {onAddFriend && (
            <button type="button" className="btn btn-secondary btn-small" onClick={onAddFriend}>
              <i className="ph-fill ph-user-plus" /> Amico
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-small" onClick={() => navigate(`/trades?to=${encodeURIComponent(user.username)}`)}>
            <i className="ph-fill ph-arrows-left-right" /> Scambia
          </button>
          {onChallenge && (
            <button type="button" className="btn btn-primary btn-small" onClick={onChallenge}>
              <i className="ph-fill ph-sword" /> Sfida
            </button>
          )}
          {profile?.roomId && (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => onVisit(profile.roomId)}>
              <i className="ph-fill ph-house-simple" /> Sua stanza
            </button>
          )}
          {isOwner && (
            <button type="button" className="btn btn-secondary btn-small" onClick={onKick}>
              <i className="ph-fill ph-door-open" /> Accompagna fuori
            </button>
          )}
        </div>
      )}
    </div>
  );
}
