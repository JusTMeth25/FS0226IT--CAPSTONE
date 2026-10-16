import { useRef } from 'react';
import DailyCard from '../card/DailyCard.jsx';
import CardTile from '../card/CardTile.jsx';
import { PACK_IMAGE, PACK_GRADIENT, PACK_ICON } from '../pack/packArt.js';
import { formatDuration } from '../../hooks/useCountdown.js';
import { getRarityColor, getRarityName } from '../../utils/cardUtils.js';
import '../../styles/home/today.css';

/**
 * In vetrina: la vetrina del negozio subito dopo la copertina.
 * Carta del giorno (col premio come cartellino), carta in evidenza (il disco esposto nella
 * sua busta) e lo scaffale dei pacchetti, che scorre in orizzontale invece di andare a capo.
 *
 * Props (fissate dal coordinatore):
 * - featuredCard: carta della collezione (come CardTile la vuole) oppure null se la collezione e' vuota
 * - packs: pacchetti del negozio (data/packs.js, senza quello gratis): { id, name, price, ... }
 * - freePack: { available: boolean, remainingMs: number, name: string }
 * - gold: number (per segnare i pacchetti che non ci si puo' permettere)
 * - onNavigate: (path) => void   pacchetti: /packs · carta: /card/<id>
 */
export default function HomeToday({ featuredCard, packs = [], freePack, gold = 0, onNavigate }) {
  return (
    <section className="ht" aria-labelledby="ht-title">
      <header className="ht-head">
        <p className="h-kicker">In vetrina</p>
        <h2 id="ht-title" className="h-title">Oggi in negozio</h2>
      </header>

      <div className="ht-window">
        <div className="ht-daily">
          <DailyCard />
        </div>
        <Featured card={featuredCard} onNavigate={onNavigate} />
      </div>

      <PackRack packs={packs} freePack={freePack} gold={gold} onNavigate={onNavigate} />
    </section>
  );
}

/** La carta piu' rara, esposta come un disco: il vinile spunta dalla busta. */
function Featured({ card, onNavigate }) {
  if (!card) {
    return (
      <div className="ht-feature ht-feature-empty h-sleeve">
        <p className="h-kicker">Carta in evidenza</p>
        <div className="ht-stage" aria-hidden="true">
          <span className="ht-vinyl" />
          <span className="ht-sleeve-empty"><i className="ph-fill ph-cards" /></span>
        </div>
        <p className="ht-feature-name">La vetrina è vuota</p>
        <p className="ht-feature-note">Apri il primo pacchetto: la carta più rara che trovi verrà esposta qui.</p>
        <button type="button" className="ht-cta" onClick={() => onNavigate('/packs')}>
          <i className="ph-fill ph-gift" /> Apri il primo pacchetto
        </button>
      </div>
    );
  }

  const href = `/card/${encodeURIComponent(card.id)}`;
  return (
    // Un link vero (non un div cliccabile): il controller e la tastiera lo raggiungono, e
    // dentro un <a> la CardTile (che e' un div) resta HTML valido.
    <a
      className="ht-feature h-sleeve"
      href={`#${href}`}
      style={{ '--rarity-color': getRarityColor(card.rarity) }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate(href);
      }}
    >
      <p className="h-kicker">Carta in evidenza</p>
      <div className="ht-stage">
        <span className="ht-vinyl" aria-hidden="true" />
        <span className="ht-card">
          <CardTile card={card} />
        </span>
      </div>
      <span className="ht-feature-name">{card.name}</span>
      <span className="ht-feature-note">
        <span className="ht-feature-rarity">{getRarityName(card.rarity)}</span> · la più rara della tua collezione
      </span>
    </a>
  );
}

/** L'espositore: il pacchetto gratis in testa, poi le copertine con il cartellino del prezzo. */
function PackRack({ packs, freePack, gold, onNavigate }) {
  const listRef = useRef(null);
  const scroll = (dir) => {
    const el = listRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const freeReady = freePack?.available;

  return (
    <div className="ht-rack">
      <div className="ht-rack-head">
        <div>
          <p className="h-kicker">Pacchetti</p>
          <h3 className="ht-rack-title">L&apos;espositore</h3>
        </div>
        <p className="ht-wallet h-num"><i className="ph-fill ph-coin" /> {gold} gold</p>
        <div className="ht-rack-tools">
          <button type="button" className="ht-arrow" onClick={() => scroll(-1)} aria-label="Pacchetti precedenti">
            <i className="ph-fill ph-caret-left" />
          </button>
          <button type="button" className="ht-arrow" onClick={() => scroll(1)} aria-label="Altri pacchetti">
            <i className="ph-fill ph-caret-right" />
          </button>
          <button type="button" className="h-link" onClick={() => onNavigate('/packs')}>
            Tutti <i className="ph-fill ph-arrow-right" />
          </button>
        </div>
      </div>

      <ul className="ht-rack-list" ref={listRef}>
        <li>
          <button
            type="button"
            className={`ht-pack ht-pack-free${freeReady ? ' is-ready' : ''}`}
            onClick={() => onNavigate('/packs')}
            aria-label={freeReady
              ? `${freePack.name} gratis: pronto da aprire`
              : `${freePack?.name || 'Pacchetto gratis'}: di nuovo gratis tra ${formatDuration(freePack?.remainingMs || 0)}`}
          >
            <PackCover id="pack-base" />
            <span className="ht-pack-name">{freePack?.name || 'Pacchetto Base'}</span>
            {freeReady ? (
              <span className="ht-tag ht-tag-free"><i className="ph-fill ph-gift" /> Gratis ora</span>
            ) : (
              <span className="ht-tag ht-tag-wait h-num">
                <i className="ph-fill ph-clock" /> {formatDuration(freePack?.remainingMs || 0)}
              </span>
            )}
          </button>
        </li>
        {packs.map((p) => {
          const missing = p.price - gold;
          const locked = missing > 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`ht-pack${locked ? ' is-locked' : ''}`}
                onClick={() => onNavigate('/packs')}
                aria-label={locked
                  ? `${p.name}, ${p.price} gold: ti mancano ${missing} gold`
                  : `${p.name}, ${p.price} gold`}
              >
                <PackCover id={p.id} />
                <span className="ht-pack-name">{p.name.replace(/^Pacchetto (?=\p{Lu})/u, '')}</span>
                {locked ? (
                  <>
                    <span className="ht-tag ht-tag-locked h-num"><i className="ph-fill ph-lock-simple" /> {p.price}</span>
                    <span className="ht-pack-miss h-num">Ti mancano {missing}</span>
                  </>
                ) : (
                  <span className="ht-tag h-num"><i className="ph-fill ph-coin" /> {p.price}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Copertina del pacchetto: la grafica se c'e', altrimenti colori e icona del gioco. */
function PackCover({ id }) {
  const img = PACK_IMAGE[id];
  return (
    <span className="ht-pack-cover" style={img ? undefined : { background: PACK_GRADIENT[id] }}>
      {img
        ? <img src={img} alt="" loading="lazy" decoding="async" />
        : <i className={`ph-fill ${PACK_ICON[id] || 'ph-package'}`} aria-hidden="true" />}
    </span>
  );
}
