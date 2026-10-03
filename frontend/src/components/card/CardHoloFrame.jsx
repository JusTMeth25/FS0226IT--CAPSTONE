import { useCardTilt } from '../../hooks/useCardTilt.js';
import { cardFinish } from '../../utils/cardUtils.js';

/**
 * Applica l'effetto holo (tilt 3D + riflesso che segue il puntatore) a un elemento carta.
 * Centralizza qui il pattern ref/style/handlers di useCardTilt, così non si ripete in ogni
 * punto dell'app che mostra una carta (CardTile, CardHero, ...).
 *
 * Con `card` le carte speciali hanno anche la loro finitura olografica (reverse, holo, cosmos,
 * ultra, vmax, vstar, rainbow, secret...: vedi cardFinish e holo-finish.css), disegnata in CSS.
 */
export default function CardHoloFrame({ rarity, card, className = '', maxTilt = 10, children, ...rest }) {
  const tilt = useCardTilt({ maxTilt });
  const finish = cardFinish(card);
  const pokemon = card?.source?.startsWith('pokemon') ? ' holo-pokemon' : '';
  const classes = `card-holo card-holo-${rarity}${finish ? ` holo-finish holo-finish-${finish}${pokemon}` : ''} ${className}`;
  return (
    // eslint-disable-next-line react-hooks/refs -- pattern standard: ref/style/handlers restituiti da un hook custom, passati al nodo che rappresentano
    <div ref={tilt.ref} className={classes} style={tilt.style} {...tilt.handlers} {...rest}>
      {children}
      {finish && <div className="card-holo-foil" aria-hidden="true" />}
    </div>
  );
}
