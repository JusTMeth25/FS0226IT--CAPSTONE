import { useCardTilt } from '../../hooks/useCardTilt.js';

/**
 * Applica l'effetto holo (tilt 3D + riflesso che segue il puntatore) a un elemento carta.
 * Centralizza qui il pattern ref/style/handlers di useCardTilt, così non si ripete in ogni
 * punto dell'app che mostra una carta (CardTile, CardHero, ...).
 * `tiltVariant="spring"` (ispirato a TiltedCard di React Bits) dà un pop più marcato e
 * un'easing elastica invece del tilt lineare standard.
 */
export default function CardHoloFrame({ rarity, className = '', maxTilt = 10, tiltVariant = null, children, ...rest }) {
  const isSpring = tiltVariant === 'spring';
  const tilt = useCardTilt({ maxTilt, scale: isSpring ? 1.06 : 1.03 });
  /* eslint-disable react-hooks/refs -- pattern standard: ref/style/handlers restituiti da un hook custom, passati al nodo che rappresentano */
  return (
    <div
      ref={tilt.ref}
      className={`card-holo card-holo-${rarity} ${isSpring ? 'card-holo-spring' : ''} ${className}`}
      style={tilt.style}
      {...tilt.handlers}
      {...rest}
    >
      {children}
    </div>
  );
  /* eslint-enable react-hooks/refs */
}
