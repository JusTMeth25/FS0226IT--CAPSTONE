import { useEffect, useState } from 'react';
import { GUITAR_STYLES } from '../sprites/avatar.js';
import { guitarPicture, hasGuitarModel, onGuitarModelReady } from '../sprites/guitarModels.js';

/**
 * Chitarra del Rock Store: la foto del modello 3D del controller vero (Guitar Hero, Rock Band)
 * quando c'e', altrimenti disegnata in SVG: forma del corpo per modello (classica, acustica,
 * a doppia spalla, a spalla singola, a V, a spigoli, basso, doppio manico), manico, paletta e corde.
 */
function body(kind, color, edge) {
  switch (kind) {
    case 'classical':
    case 'acoustic':
      return (
        <g fill={color} stroke={edge} strokeWidth="1.5">
          <ellipse cx="40" cy="70" rx={kind === 'acoustic' ? 19 : 16} ry="15" />
          <ellipse cx="40" cy="50" rx={kind === 'acoustic' ? 14 : 12} ry="11" />
          <ellipse cx="40" cy="60" rx="11" ry="6" stroke="none" />
        </g>
      );
    case 'v':
      return <polygon points="40,46 62,92 50,92 40,72 30,92 18,92" fill={color} stroke="#111" strokeWidth="1.5" />;
    case 'explorer':
      return <polygon points="30,44 50,44 64,58 58,62 60,88 44,84 22,90 26,62" fill={color} stroke="#555" strokeWidth="1.5" />;
    case 'lp':
      return (
        <g fill={color} stroke="#3a1c04" strokeWidth="1.5">
          <ellipse cx="40" cy="70" rx="18" ry="16" />
          <ellipse cx="36" cy="52" rx="12" ry="10" />
        </g>
      );
    case 'double':
      return <path d="M22 60 Q20 46 30 46 L50 46 Q60 46 58 60 Q66 76 52 90 L28 90 Q14 76 22 60 Z" fill={color} stroke="#111" strokeWidth="1.5" />;
    default:
      // Doppia spalla mancante (e i bassi, piu' lunghi).
      return <path d="M24 56 Q20 44 28 46 Q32 54 40 52 Q48 50 50 42 Q58 42 56 56 Q64 72 54 88 Q40 96 26 88 Q16 72 24 56 Z" fill={color} stroke="#111" strokeWidth="1.5" />;
  }
}

export default function GuitarFace({ index, big = false }) {
  const style = GUITAR_STYLES[index];
  const [, setReady] = useState(0);
  useEffect(() => (hasGuitarModel(index) ? onGuitarModelReady(() => setReady((n) => n + 1)) : undefined), [index]);
  if (!style) return null;
  const photo = guitarPicture(index);
  if (photo) return <img className={big ? 'guitar-face big' : 'lux-watch lux-guitar'} src={photo} alt="" aria-hidden="true" />;
  const bass = style.kind === 'bass';
  const neckTop = bass ? -6 : 4;
  const strings = bass ? 4 : 6;
  const neck = (x) => (
    <g key={x}>
      <rect x={x - 3.5} y={neckTop} width="7" height={52 - neckTop} fill="#7c4a1e" />
      <rect x={x - 4.5} y={neckTop - 10} width="9" height="11" rx="2" fill="#27272a" />
      {Array.from({ length: 8 }, (_, i) => <line key={i} x1={x - 3.5} x2={x + 3.5} y1={neckTop + 6 + i * 5.5} y2={neckTop + 6 + i * 5.5} stroke="#d4d4d8" strokeWidth="0.6" />)}
    </g>
  );
  return (
    <svg className={big ? 'guitar-face big' : 'lux-watch'} viewBox="-4 -18 88 116" aria-hidden="true">
      <g transform="rotate(35 40 50)">
        {style.kind === 'double' ? [neck(34), neck(46)] : neck(40)}
        {body(style.kind, style.body, style.edge || '#111')}
        {style.burst && <ellipse cx="40" cy="70" rx="9" ry="8" fill={style.burst} opacity="0.35" />}
        {style.hole && <circle cx="40" cy="60" r="5" fill="#1c1208" />}
        {style.guard && !style.hole && <path d="M42 62 Q52 64 50 78 L40 80 Z" fill={style.guard} opacity="0.9" />}
        <rect x="33" y="78" width="14" height="3" rx="1" fill="#d4d4d8" />
        {Array.from({ length: strings }, (_, i) => {
          const x = 40 - (strings - 1) * 0.8 + i * 1.6;
          return <line key={i} x1={x} x2={x} y1={neckTop} y2="79" stroke="#f5f5f5" strokeWidth="0.4" opacity="0.8" />;
        })}
      </g>
    </svg>
  );
}
