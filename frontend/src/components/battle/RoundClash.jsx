import { m } from 'motion/react';
import RevealSpark from '../common/RevealSpark.jsx';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';
import { SlamIn } from './PhantomFx.jsx';
import { clashSide } from './phantomMotion.js';

function Side({ label, card, value, bonus, won, lost, fromRight }) {
  const color = getRarityColor(card.rarity);
  return (
    <m.div
      className={`battle-comp-card${won ? ' battle-winner' : ''}${lost ? ' battle-loser' : ''}`}
      style={{ '--rarity-color': color }}
      {...clashSide(fromRight, lost)}
    >
      <span className="battle-comp-side">{label}</span>
      <div className="battle-comp-art">
        <img src={resolveCardImage(card)} alt="" decoding="sync" />
        {won && <RevealSpark color={color} count={10} radius={38} />}
      </div>
      <span className="battle-comp-name">{card.name}</span>
      <div className="battle-comp-stat">
        <span className="battle-comp-value">{value}</span>
        {bonus && <span className="battle-bonus">{bonus} <i className="ph-fill ph-sparkle" /></span>}
        {won && <SlamIn className="battle-badge-win" delay={0.32} tilt={-8}>WIN</SlamIn>}
      </div>
    </m.div>
  );
}

/**
 * Confronto di un round: la tua carta e quella dell'avversario arrivano dai due lati, il VS
 * piomba in mezzo e il timbro WIN cade su chi vince. Stesso markup per la partita contro gli
 * NPC e per la sfida online.
 *
 * @param you / opponent { label, card, value, bonus } (bonus: testo gia' pronto, es. "+12")
 * @param winner 'you' | 'opponent' | null (pareggio)
 */
export default function RoundClash({ category, you, opponent, winner }) {
  return (
    <div className="battle-comparison">
      <Side {...you} won={winner === 'you'} lost={winner === 'opponent'} />
      <div className="battle-comp-vs">
        <SlamIn className="battle-comp-vs-text" delay={0.12} tilt={-8}>VS</SlamIn>
        <span className="battle-comp-detail">{category}</span>
      </div>
      <Side {...opponent} won={winner === 'opponent'} lost={winner === 'you'} fromRight />
    </div>
  );
}
