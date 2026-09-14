import { getRarityColor } from '../../utils/cardUtils.js';

/**
 * Tinge la pagina con il colore della rarita' della carta che si sta guardando.
 *
 * Una scheda carta ha sempre lo stesso sfondo, che sia una comune o una leggendaria.
 * Questo strato fa in modo che la pagina cambi atmosfera con la carta, cosi' la rarita'
 * si percepisce entrando nella pagina e non solo leggendo l'etichetta.
 *
 * E' posizionato fisso e coprente, ma sta dietro al contenuto e non intercetta il
 * puntatore: l'aurora di sfondo resta visibile sotto, solo tinta.
 *
 * @param {boolean} muted meta' intensita', per le carte non ancora scoperte
 */
export default function RarityAmbience({ rarity, muted = false }) {
  const color = getRarityColor(rarity);

  return (
    <div
      className={`rarity-ambience${muted ? ' rarity-ambience-muted' : ''}`}
      style={{ '--rarity-color': color }}
      aria-hidden="true"
    />
  );
}
