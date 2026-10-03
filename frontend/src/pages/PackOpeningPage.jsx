import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useSound } from '../hooks/useSound.js';
import { useCountUp } from '../hooks/useCountUp.js';
import { PACKS } from '../data/packs.js';
import PityBar from '../components/pack/PityBar.jsx';
import NotifyToggle from '../components/pack/NotifyToggle.jsx';
import { apiClient } from '../services/apiClient.js';
import { formatDuration } from '../hooks/useCountdown.js';
import StarBorder from '../components/common/StarBorder.jsx';
import CardHoloFrame from '../components/card/CardHoloFrame.jsx';
import PackOpeningFlow from '../components/pack/PackOpeningFlow.jsx';
import { PACK_GRADIENT, PACK_ICON, PACK_IMAGE, PACK_TILT_RARITY, PACK_NAMED_ART } from '../components/pack/packArt.js';

/** Riflesso olografico + sparkle sopra la card pacchetto, stesso pattern usato per le carte. */
// I pacchetti misti pescano da tutti i giochi; gli altri da uno solo (Ultimate Team compreso).
const PACK_GROUPS = [
  { title: 'Pacchetti misti', filter: (pack) => !pack.source },
  { title: 'Pacchetti per gioco', filter: (pack) => Boolean(pack.source) }
];

function PackHoloLayers() {
  return (
    <>
      <div className="card-holo-glare" />
      <div className="card-holo-rainbow" />
      <div className="card-holo-sparkles">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`card-sparkle card-sparkle-${i + 1}`} />
        ))}
      </div>
    </>
  );
}

/** Quanto manca a una data, in giorni e ore (per il pacchetto del weekend). */
function until(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'poco';
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)} g ${h % 24} h` : `${h} h ${Math.floor((ms % 3_600_000) / 60_000)} min`;
}

function PackSelectCard({ pack, gold, isFreeAvailable, cooldownRemaining, giftedCount, onOpen, submitting, weekend }) {
  const canAffordPaid = gold >= pack.price;
  // Il pacchetto del weekend si apre solo sabato e domenica (i regali in borsa sempre).
  const closed = pack.weekend && !weekend?.active;
  const packImage = PACK_IMAGE[pack.id];

  return (
    <CardHoloFrame rarity={PACK_TILT_RARITY[pack.id] || 'rare'} maxTilt={6} className="pack-card">
      <div className="pack-card-art-wrap" style={{ background: packImage ? undefined : PACK_GRADIENT[pack.id] }}>
        {packImage ? (
          <>
            <img loading="lazy" decoding="async" className="pack-card-art-full" src={packImage} alt={pack.name} />
            {/* La grafica dei pacchetti di un solo gioco e' il dorso delle carte: il nome va scritto. */}
            {pack.source && !PACK_NAMED_ART.has(pack.id) && <span className="pack-card-name-tag">{pack.name.replace('Pacchetto ', '')}</span>}
          </>
        ) : (
          <>
            <span className="pack-icon"><i className={`ph-fill ${PACK_ICON[pack.id] || 'ph-gift'}`} /></span>
            <h3 className="pack-card-name">{pack.name}</h3>
          </>
        )}
        <span className="pack-card-count">{pack.cardCount} carte</span>
        {pack.weekend && weekend?.setTitle && (
          <span className="pack-weekend-set"><i className="ph-fill ph-star" /> Set: {weekend.setTitle}</span>
        )}
        {giftedCount > 0 && <span className="pack-card-price-badge pack-card-price-free pack-card-gift-badge"><i className="ph-fill ph-gift" /> x{giftedCount}</span>}
        <PackHoloLayers />
      </div>
      <div className="pack-card-body pack-card-body-slim">
        <div className="pack-card-actions">
          {giftedCount > 0 && (
            <button className="btn btn-primary" disabled={submitting} onClick={() => onOpen(pack.id, 'gift')}>
              <i className="ph-fill ph-gift" /> Apri Regalo (x{giftedCount})
            </button>
          )}
          {pack.isFree && (
            isFreeAvailable
              ? <button className="btn btn-primary" disabled={submitting} onClick={() => onOpen(pack.id, 'free')}><i className="ph-fill ph-sparkle" /> Apri Gratis</button>
              : <button className="btn btn-secondary" disabled><i className="ph-fill ph-hourglass" /> Gratis tra {formatDuration(cooldownRemaining).slice(0, 5)}</button>
          )}
          {closed ? (
            <button className="btn btn-secondary" disabled>
              <i className="ph-fill ph-lock-simple" /> {weekend ? `Apre fra ${until(weekend.startsAt)}` : 'Solo nel weekend'}
            </button>
          ) : pack.id === 'pack-premium' && canAffordPaid ? (
            <StarBorder color="#FFD700" speed="3s">
              <button className="btn btn-gold" style={{ width: '100%' }} disabled={submitting} onClick={() => onOpen(pack.id, 'paid')}>
                <i className="ph-fill ph-coin" /> {submitting ? 'Apertura…' : `Apri Pacchetto (${pack.price})`}
              </button>
            </StarBorder>
          ) : (
            <button
              className={`btn ${canAffordPaid ? 'btn-primary' : 'btn-secondary'}`}
              disabled={submitting}
              onClick={() => onOpen(pack.id, 'paid')}
            >
              <i className="ph-fill ph-coin" /> {submitting ? 'Apertura…' : pack.isFree ? `Compra (${pack.price})` : `Apri Pacchetto (${pack.price})`}
            </button>
          )}
        </div>
      </div>
    </CardHoloFrame>
  );
}

export default function PackOpeningPage() {
  const game = useGame();
  const { sound } = useSound();
  const navigate = useNavigate();
  const displayGold = useCountUp(game.gold);

  const [selectedPack, setSelectedPack] = useState(null);
  const [cards, setCards] = useState([]);
  // Cresce a ogni apertura: rimonta l'animazione da capo anche aprendo due volte lo stesso pacchetto.
  const [openingId, setOpeningId] = useState(0);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [weekend, setWeekend] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/pack-weekend').then((res) => { if (!cancelled) setWeekend(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Il messaggio d'errore sparisce da solo: il timer va annullato se si lascia la pagina prima.
  const pendingTimers = useRef(new Set());
  const trackedTimeout = useCallback((fn, ms) => {
    const id = setTimeout(() => { pendingTimers.current.delete(id); fn(); }, ms);
    pendingTimers.current.add(id);
    return id;
  }, []);
  useEffect(() => () => { pendingTimers.current.forEach(clearTimeout); }, []);

  const basePack = PACKS.find((p) => p.isFree);
  const cooldownRemaining = game.getFreeCooldownRemaining(basePack);
  const isFreeAvailable = game.isFreeAvailable(basePack);

  const ERROR_MESSAGES = {
    insufficient_gold: 'Non hai abbastanza gold per questo pacchetto.',
    cooldown: 'Il pacchetto gratuito non è ancora disponibile.',
    no_gift_available: 'Non hai più pacchetti regalo di questo tipo.',
    open_pack_failed: 'Non è stato possibile aprire il pacchetto. Riprova.',
    weekend_only: 'Il Pacchetto del Weekend si apre solo sabato e domenica.'
  };

  async function handleOpen(packId, mode) {
    // Guardia anti doppio-click: senza, un secondo click mentre la richiesta è in corso
    // avviava una seconda apertura che, arrivando in ritardo, faceva ripartire da capo
    // l'animazione di reveal già avviata dalla prima.
    if (submitting) return;

    const pack = PACKS.find((p) => p.id === packId);
    if (mode === 'paid' && game.gold < pack.price) {
      sound.error();
      setNotice(ERROR_MESSAGES.insufficient_gold);
      trackedTimeout(() => setNotice(null), 3000);
      return;
    }

    setSubmitting(true);
    const res = await game.openPack(packId, mode);
    setSubmitting(false);

    if (res.error) {
      sound.error();
      setNotice(ERROR_MESSAGES[res.error] || ERROR_MESSAGES.open_pack_failed);
      trackedTimeout(() => setNotice(null), 3000);
      return;
    }
    setSelectedPack(pack);
    setCards(res.cards);
    setOpeningId((n) => n + 1);
  }

  function resetToSelect() {
    setSelectedPack(null);
    setCards([]);
  }

  if (!selectedPack) {
    return (
      <section className="packs-page">
        <h2 className="section-title text-gradient"><i className="ph-fill ph-gift" /> Apri un Pacchetto</h2>
        <p className="text-center packs-subtitle">Scegli il pacchetto che vuoi aprire</p>

        <div className="gold-display glass-panel">
          <span className="gold-icon"><i className="ph-fill ph-coin" /></span>
          <span className="gold-amount">{displayGold}</span>
          <span className="gold-label">Gold disponibili</span>
        </div>

        <PityBar version={openingId} />
        <div className="text-center notify-row"><NotifyToggle /></div>

        {PACK_GROUPS.map((group) => (
          <div key={group.title} className="packs-group">
            <h3 className="packs-group-title">{group.title}</h3>
            <div className="packs-grid">
              {PACKS.filter(group.filter).map((pack) => (
                <PackSelectCard
                  key={pack.id}
                  pack={pack}
                  gold={game.gold}
                  isFreeAvailable={pack.isFree && isFreeAvailable}
                  cooldownRemaining={cooldownRemaining}
                  giftedCount={game.freePacks[pack.id] || 0}
                  onOpen={handleOpen}
                  submitting={submitting}
                  weekend={weekend}
                />
              ))}
            </div>
          </div>
        ))}

        {notice && (
          <div className="pack-overlay">
            <div className="pack-modal glass-panel">
              <div className="pack-modal-icon"><i className="ph-fill ph-warning-circle" /></div>
              <h3>Gold insufficienti!</h3>
              <p>{notice}</p>
              <p className="text-muted">Completa missioni e vendi carte nel mercato per guadagnare gold!</p>
              <button className="btn btn-primary" onClick={() => setNotice(null)}>Chiudi</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="pack-opening-page">
      <h2 className="section-title text-gradient">Apertura Pacchetto</h2>
      <PackOpeningFlow
        key={openingId}
        packId={selectedPack.id}
        cards={cards}
        actions={[
          { label: 'Apri un Altro', icon: 'ph-gift', onClick: resetToSelect, primary: true },
          { label: 'Vai alla Collezione', icon: 'ph-cards', onClick: () => navigate('/collection') }
        ]}
      />
    </section>
  );
}
