import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient.js';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';
import AvatarPreview from './AvatarPreview.jsx';
import PhotoGallery from '../../components/common/PhotoGallery.jsx';
import CompareCollections from '../../components/card/CompareCollections.jsx';

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
export default function UserCard({ user, look, isMe, isOwner, respectVersion, onClose, onWhisper, onRespect, onKick, onVisit, onChallenge, onViewCard, onAddFriend, onWearBadge, onGift, onPickCard, onChooseTopCards }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);

  // Nella propria scheda un distintivo si indossa (o si toglie) con un click.
  const wear = (code) => {
    if (!onWearBadge || busy) return;
    const next = profile?.wornBadge === code ? null : code;
    setBusy(true);
    onWearBadge(next)
      .then((res) => setProfile((p) => ({ ...p, wornBadge: res.wornBadge })))
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  // Nella propria scheda le tre carte sopra la testa si cambiano una alla volta.
  const changeTopCard = async (slot) => {
    if (!onPickCard || !onChooseTopCards || busy) return;
    const card = await onPickCard(`Carta sopra la testa n. ${slot + 1}`);
    if (!card) return;
    const codes = (profile?.topCards || []).map((c) => c.id);
    const other = codes.indexOf(card.id);
    // Se la carta era gia' in un altro posto, i due posti si scambiano.
    if (other >= 0 && other !== slot) codes[other] = codes[slot];
    codes[slot] = card.id;
    saveTopCards(codes.filter(Boolean));
  };

  const saveTopCards = (codes) => {
    setBusy(true);
    onChooseTopCards(codes)
      .then((res) => setProfile((p) => ({ ...p, topCards: res.topCards, topCardsCustom: res.topCardsCustom })))
      .catch(() => {})
      .finally(() => setBusy(false));
  };

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
              {profile.badges.map((b) => {
                const worn = profile.wornBadge === b.code;
                const icon = <i className={`ph-fill ${BADGE_ICONS[b.code] || (b.icon ? `ph-${b.icon}` : 'ph-seal-check')}`} />;
                return onWearBadge ? (
                  <button key={b.code} type="button" className={`hotel-badge hotel-badge-${b.code}${worn ? ' worn' : ''}`} disabled={busy}
                    onClick={() => wear(b.code)} aria-pressed={worn}
                    title={`${b.name}: ${b.description}. ${worn ? 'In mostra accanto al nome: clicca per toglierlo' : 'Clicca per metterlo accanto al nome'}`}>
                    {icon}
                  </button>
                ) : (
                  <span key={b.code} className={`hotel-badge hotel-badge-${b.code}${worn ? ' worn' : ''}`} title={`${b.name}: ${b.description}${worn ? ' (in mostra)' : ''}`}>
                    {icon}
                  </span>
                );
              })}
            </div>
          )}
          {onWearBadge && profile?.badges?.length > 0 && (
            <small className="hotel-badges-hint">Clicca un distintivo per mostrarlo accanto al tuo nome.</small>
          )}
        </div>
      </div>

      {profile?.bestCard && (
        <button type="button" className="hotel-best-card" style={{ '--rarity-color': getRarityColor(profile.bestCard.rarity) }} onClick={() => onViewCard(profile.bestCard)}>
          <i className="ph-fill ph-star" /> Carta migliore: <strong>{profile.bestCard.name}</strong>
        </button>
      )}

      {profile?.topCards?.length > 0 && (
        <div className="hotel-top-cards">
          <div className="hotel-top-cards-head">
            <span><i className="ph-fill ph-cards-three" /> Carte sopra la testa</span>
            {onChooseTopCards && profile.topCardsCustom && (
              <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => saveTopCards([])}
                title="Le sceglie il gioco: le piu' usate in battaglia, poi le piu' costose">
                Automatiche
              </button>
            )}
          </div>
          <div className="hotel-top-cards-row">
            {profile.topCards.map((card, slot) => (
              <button key={`${slot}-${card.id}`} type="button" className="hotel-top-card" disabled={busy}
                style={{ '--rarity-color': getRarityColor(card.rarity) }}
                onClick={() => (onChooseTopCards ? changeTopCard(slot) : onViewCard(card))}
                title={onChooseTopCards ? `${card.name}: clicca per cambiarla` : card.name}>
                <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
                {onChooseTopCards && <span className="hotel-top-card-edit"><i className="ph-bold ph-swap" /> Cambia</span>}
              </button>
            ))}
          </div>
          {onChooseTopCards && !profile.topCardsCustom && (
            <small className="hotel-badges-hint">Ora le sceglie il gioco. Clicca una carta per mettere quella che vuoi.</small>
          )}
        </div>
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
          {onGift && (
            <button type="button" className="btn btn-secondary btn-small" onClick={onGift} title="Regala gold, una carta o un mobile (solo agli amici)">
              <i className="ph-fill ph-gift" /> Regala
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setComparing(true)}>
            <i className="ph-fill ph-git-diff" /> Confronta
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
      {/* Fuori dalla scheda (che scorre e taglia): il confronto sta sopra tutto. */}
      {comparing && createPortal(<CompareCollections user={user} onClose={() => setComparing(false)} />, document.body)}
    </div>
  );
}
