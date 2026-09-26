/**
 * Fonti e diritti delle carte EA FC 27: dati e foto vengono dalla classifica ufficiale EA,
 * i prezzi sono stime nostre. Progetto didattico non ufficiale.
 */
export const EA_RATINGS_URL = 'https://www.ea.com/games/ea-sports-fc/ratings';

export default function Fc27Credits() {
  return (
    <p className="card-detail-credits">
      Valutazioni, statistiche e foto dei giocatori:{' '}
      <a href={EA_RATINGS_URL} target="_blank" rel="noopener noreferrer">EA SPORTS FC™ 27 Player Ratings</a>.
      Prezzi in crediti stimati da VinylDex, non ufficiali.
      © Electronic Arts Inc. EA, EA SPORTS, EA SPORTS FC e Ultimate Team sono marchi di Electronic Arts Inc.
      VinylDex è un progetto didattico non ufficiale, non affiliato né approvato da Electronic Arts.
    </p>
  );
}
