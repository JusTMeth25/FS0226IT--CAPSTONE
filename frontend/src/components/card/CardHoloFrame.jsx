import { useCardTilt } from '../../hooks/useCardTilt.js';

/**
 * Applica l'effetto holo (tilt 3D + riflesso che segue il puntatore) a un elemento carta.
 * Centralizza qui il pattern ref/style/handlers di useCardTilt, così non si ripete in ogni
 * punto dell'app che mostra una carta (CardTile, CardHero, ...).
 */
export default function CardHoloFrame({ rarity, className = '', maxTilt = 10, children, ...rest }) {
  const tilt = useCardTilt({ maxTilt });
  return (
    // eslint-disable-next-line react-hooks/refs -- pattern standard: ref/style/handlers restituiti da un hook custom, passati al nodo che rappresentano
    <div ref={tilt.ref} className={`card-holo card-holo-${rarity} ${className}`} style={tilt.style} {...tilt.handlers} {...rest}>
      {children}
    </div>
  );
}
