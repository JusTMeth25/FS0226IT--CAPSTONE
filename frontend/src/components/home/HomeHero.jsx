import { useState } from 'react';
import { m } from 'motion/react';
import { formatDuration } from '../../hooks/useCountdown.js';
import { HOME_MODELS, modelSrc, pickHomeModel } from '../../data/homeModels.js';
import PhantomTitle from '../phantom/PhantomTitle.jsx';
import StarBurst from '../phantom/StarBurst.jsx';
import '../../styles/home/hero.css';

// Scorciatoie: poche, sempre le stesse, nell'ordine della barra di navigazione.
const SHORTCUTS = [
  { path: '/hotel', label: 'Hotel', icon: 'ph-buildings' },
  { path: '/battle', label: 'Battaglia', icon: 'ph-sword' },
  { path: '/binder', label: 'Raccoglitore', icon: 'ph-book-open' },
  { path: '/marketplace', label: 'Mercato', icon: 'ph-storefront' }
];

const numberFormat = new Intl.NumberFormat('it-IT');
const snap = { type: 'spring', stiffness: 520, damping: 28 };

/**
 * Copertina della Home in stile Persona 5: a sinistra il titolo enorme a ritaglio, chi sei e
 * l'azione principale (il pacchetto gratis); a destra il "modello", la figura ritagliata da una
 * carta originale VinylDex, diversa a ogni apertura (data/homeModels.js).
 *
 * Props: username, level, xp { current, next, percent }, stats { ownedCount, gold, wins }
 * (progressPercent non serve: la percentuale esatta dell'album sta nello scaffale), freePack
 * { available, remainingMs, name }, onNavigate(path).
 */
export default function HomeHero({ username, level, xp, stats, freePack, onNavigate }) {
  const [model] = useState(pickHomeModel);
  const percent = Math.min(100, Math.max(0, Math.round(xp?.percent || 0)));
  const xpCurrent = xp?.current || 0;
  const xpNext = xp?.next || 0;
  const tracks = [
    { label: 'Carte uniche', value: numberFormat.format(stats?.ownedCount || 0) },
    { label: 'Gold', value: numberFormat.format(stats?.gold || 0) },
    { label: 'Vittorie', value: numberFormat.format(stats?.wins || 0) }
  ];
  const cardPath = `/card/${encodeURIComponent(model.card)}`;
  const srcSet = `${modelSrc(model, true)} 440w, ${modelSrc(model)} 760w`;

  return (
    <header className="hp">
      {/* Mappa colori della figura: ombre nere, mezzitoni viola/magenta, luci bianche
          (il rosso/nero di P5 con i colori di VinylDex). */}
      <svg className="hp-defs" aria-hidden="true" focusable="false">
        <filter id="hp-duotone" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.03 0.33 0.93 1" />
            <feFuncG type="table" tableValues="0.02 0.12 0.28 1" />
            <feFuncB type="table" tableValues="0.06 0.55 0.60 1" />
          </feComponentTransfer>
        </filter>
      </svg>

      <div className="hp-bg" aria-hidden="true">
        <span className="hp-shard hp-shard-1" />
        <span className="hp-shard hp-shard-2" />
        <span className="hp-shard hp-shard-3" />
        <StarBurst size={64} className="hp-star hp-star-1" />
        <StarBurst size={38} fill="#fff" stroke="#000" className="hp-star hp-star-2" />
        <StarBurst size={28} className="hp-star hp-star-3" />
      </div>

      <m.figure
        className="hp-model"
        initial={{ x: 60, opacity: 0, rotate: 2 }}
        animate={{ x: 0, opacity: 1, rotate: 0 }}
        transition={{ ...snap, delay: 0.05 }}
      >
        <span className="hp-model-art">
          <img
            className="hp-model-img"
            src={modelSrc(model)}
            srcSet={srcSet}
            sizes="(max-width: 720px) 70vw, 44vw"
            alt=""
            fetchPriority="high"
            decoding="async"
            onError={(e) => { if (model.slug !== HOME_MODELS[0].slug) e.currentTarget.src = modelSrc(HOME_MODELS[0]); }}
          />
          {/* Stessa immagine (stesso download) col filtro a due toni sopra: i colori veri restano
              solo in trasparenza, come gli accenti di colore sulle figure in bianco e nero di P5. */}
          <img className="hp-model-img hp-model-duo" src={modelSrc(model)} srcSet={srcSet}
            sizes="(max-width: 720px) 70vw, 44vw" alt="" decoding="async" />
        </span>
        <figcaption>
          <a
            className="hp-model-tag"
            href={`#${cardPath}`}
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              onNavigate(cardPath);
            }}
          >
            <span>Modello</span> <strong>{model.name}</strong>
          </a>
        </figcaption>
      </m.figure>

      <div className="hp-copy">
        <m.p className="hp-kicker" initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={snap}>
          {'// la tua collezione, la tua storia //'}
        </m.p>
        <m.div initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...snap, delay: 0.06 }}>
          <PhantomTitle as="h1" variant="headline" text={'Ogni carta,\nun assolo'} highlight="assolo" className="hp-title" />
        </m.div>

        <div className="hp-who">
          <span className="hp-lv" aria-hidden="true">
            {/* Stella disegnata dietro e numero sopra: tagliare il riquadro a stella mangiava le cifre. */}
            <StarBurst size={84} inner={false} className="hp-lv-star" />
            <b className="hp-lv-n">{level}</b>
          </span>
          <div className="hp-who-text">
            <p className="hp-name" title={username}>{username} <span className="hp-name-lv">Lv {level}</span></p>
            <div
              className="hp-xp"
              role="progressbar"
              aria-label={`Livello ${level}, verso il livello ${level + 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={`${xpCurrent} XP su ${xpNext}`}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            <p className="hp-xp-text h-num">
              {numberFormat.format(xpCurrent)} / {numberFormat.format(xpNext)} XP · mancano {numberFormat.format(Math.max(0, xpNext - xpCurrent))} al Lv {level + 1}
            </p>
          </div>
        </div>

        <div className="hp-actions">
          {freePack?.available ? (
            <button type="button" className="hp-cta" onClick={() => onNavigate('/packs')}>
              <i className="ph-fill ph-gift" aria-hidden="true" />
              <span>Apri il pacchetto gratis</span>
              <i className="ph ph-arrow-right" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="hp-cta hp-cta-wait" onClick={() => onNavigate('/packs')}>
              <span className="hp-cta-small">Prossimo gratis fra</span>
              <span className="h-num" role="timer" aria-live="off">
                {freePack?.remainingMs > 0 ? formatDuration(freePack.remainingMs) : 'a momenti'}
              </span>
              <i className="ph ph-arrow-right" aria-hidden="true" />
            </button>
          )}
          <button type="button" className="hp-ghost" onClick={() => onNavigate('/collection')}>
            <span>La mia collezione</span>
            <i className="ph ph-arrow-right" aria-hidden="true" />
          </button>
        </div>

        <ul className="hp-stats" aria-label="I tuoi numeri">
          {tracks.map((t) => (
            <li key={t.label}><strong className="h-num">{t.value}</strong><span>{t.label}</span></li>
          ))}
        </ul>

        <nav className="hp-short" aria-label="Scorciatoie">
          {SHORTCUTS.map((s) => (
            <button key={s.path} type="button" onClick={() => onNavigate(s.path)}>
              <i className={`ph-fill ${s.icon}`} aria-hidden="true" /> {s.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
