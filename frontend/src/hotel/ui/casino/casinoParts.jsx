import { CHIPS, chipStyle } from './casinoUtils.js';

/**
 * Pezzi comuni dei tavoli del casino: carte da gioco, fiches, dadi e la scelta della puntata.
 * Disegnati in SVG e CSS, nello stile dei casino "realistici" (panno verde, oro, carte bianche
 * con gli angoli arrotondati).
 */

const SUITS = {
  S: { glyph: '♠', color: '#111018', name: 'picche' },
  H: { glyph: '♥', color: '#c1121f', name: 'cuori' },
  D: { glyph: '♦', color: '#c1121f', name: 'quadri' },
  C: { glyph: '♣', color: '#111018', name: 'fiori' }
};

/** Una carta da "AS", "10H", "QD"; "??" (o niente) e' una carta coperta. */
export function PlayingCard({ code, held = false, onClick, small = false, delay = 0 }) {
  const hidden = !code || code === '??';
  const rank = hidden ? '' : code.slice(0, -1);
  const suit = hidden ? null : SUITS[code.slice(-1)];
  const label = hidden ? 'Carta coperta' : `${rank} di ${suit.name}`;
  const face = ['J', 'Q', 'K'].includes(rank);
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`casino-card${small ? ' small' : ''}${held ? ' held' : ''}${hidden ? ' back' : ''}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={onClick ? held : undefined}
      style={{ animationDelay: `${delay}ms` }}
    >
      <svg viewBox="0 0 100 140" aria-hidden="true">
        {hidden ? (
          <>
            <rect x="2" y="2" width="96" height="136" rx="9" fill="#7a0f1c" stroke="#d4a537" strokeWidth="3" />
            <rect x="10" y="10" width="80" height="120" rx="5" fill="none" stroke="#d4a537" strokeWidth="1.5" />
            {Array.from({ length: 6 }, (_, i) => (
              <path key={i} d={`M50 ${20 + i * 18} l10 9 l-10 9 l-10 -9 z`} fill="none" stroke="#e8c76b" strokeWidth="1.2" />
            ))}
            <circle cx="50" cy="70" r="14" fill="#4e0912" stroke="#d4a537" strokeWidth="2" />
            <circle cx="50" cy="70" r="4" fill="#d4a537" />
          </>
        ) : (
          <>
            <rect x="2" y="2" width="96" height="136" rx="9" fill="#fdfbf5" stroke="#cfc6b0" strokeWidth="2" />
            <text x="9" y="26" fontSize="22" fontWeight="700" fill={suit.color} fontFamily="Georgia, serif">{rank}</text>
            <text x="10" y="46" fontSize="20" fill={suit.color}>{suit.glyph}</text>
            <g transform="rotate(180 50 70)">
              <text x="9" y="26" fontSize="22" fontWeight="700" fill={suit.color} fontFamily="Georgia, serif">{rank}</text>
              <text x="10" y="46" fontSize="20" fill={suit.color}>{suit.glyph}</text>
            </g>
            {face ? (
              <>
                <rect x="24" y="30" width="52" height="80" rx="4" fill="none" stroke={suit.color} strokeWidth="1.5" />
                <text x="50" y="84" textAnchor="middle" fontSize="40" fontWeight="700" fill={suit.color} fontFamily="Georgia, serif">{rank}</text>
                <text x="50" y="104" textAnchor="middle" fontSize="16" fill="#d4a537">♛</text>
              </>
            ) : (
              <text x="50" y="86" textAnchor="middle" fontSize={rank === 'A' ? 52 : 40} fill={suit.color}>{suit.glyph}</text>
            )}
          </>
        )}
      </svg>
      {held && <b className="casino-held">TENUTA</b>}
    </Tag>
  );
}

/** Una fiche con il valore stampato al centro e le tacche sul bordo. */
export function Chip({ value, size = 44, onClick, active = false, label }) {
  const s = chipStyle(value);
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`casino-chip${active ? ' active' : ''}`} onClick={onClick}
      style={{ width: size, height: size }} aria-label={label || `Fiche da ${value}`} aria-pressed={onClick ? active : undefined}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="48" fill={s.color} stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="45" y="2" width="10" height="16" fill={s.edge} transform={`rotate(${i * 45} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="32" fill={s.color} stroke={s.edge} strokeWidth="3" strokeDasharray="6 4" />
        <text x="50" y="58" textAnchor="middle" fontSize={value >= 1000 ? 22 : 26} fontWeight="800" fill={s.text} fontFamily="Georgia, serif">
          {value >= 1000 ? `${value / 1000}K` : value}
        </text>
      </svg>
    </Tag>
  );
}

/** Scelta del taglio della fiche da puntare. */
export function ChipSelector({ value, onChange, max }) {
  return (
    <div className="casino-chip-selector" role="radiogroup" aria-label="Valore della fiche">
      {CHIPS.filter((c) => c.value <= max).map((c) => (
        <Chip key={c.value} value={c.value} size={40} active={value === c.value} onClick={() => onChange(c.value)} />
      ))}
    </div>
  );
}

/** Un dado (1-6) con i puntini; `rolling` lo fa girare. */
export function Die({ value, rolling = false }) {
  const pips = {
    1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]]
  }[value] || [];
  return (
    <span className={`casino-die${rolling ? ' rolling' : ''}`} aria-label={`Dado: ${value}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <rect x="4" y="4" width="92" height="92" rx="16" fill="#c1121f" stroke="#7a0f1c" strokeWidth="3" />
        <rect x="10" y="10" width="80" height="80" rx="12" fill="rgba(255,255,255,0.08)" />
        {pips.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill="#fdfbf5" />)}
      </svg>
    </span>
  );
}

