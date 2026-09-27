/**
 * Fonti e diritti delle carte dei giochi importati dal catalogo TCGplayer (tcgcsv.com): immagini,
 * dati e prezzi di mercato vengono da li'. Progetto didattico non ufficiale.
 */
const GAMES = {
  cyberpunk: { game: 'Cyberpunk TCG', rights: 'Cyberpunk © CD PROJEKT S.A.' },
  hololive: { game: 'hololive OFFICIAL CARD GAME', rights: 'hololive © COVER Corporation.' },
  unionarena: { game: 'Union Arena (anime)', rights: 'UNION ARENA © BANDAI; le serie anime © dei rispettivi autori ed editori.' },
  shadowverse: { game: 'Shadowverse: Evolve', rights: 'Shadowverse © Cygames, Inc.' },
  wixoss: { game: 'WIXOSS', rights: 'WIXOSS © LRIG / TOMY.' },
  grandarchive: { game: 'Grand Archive', rights: 'Grand Archive © Weebs of the Shore.' },
  weiss: { game: 'Weiss Schwarz', rights: 'Weiss Schwarz © Bushiroad; le serie anime © dei rispettivi autori ed editori.' },
  vanguard: { game: 'Cardfight!! Vanguard', rights: 'Cardfight!! Vanguard © Bushiroad.' },
};

export default function TcgplayerCredits({ source }) {
  const info = GAMES[source];
  if (!info) return null;
  return (
    <p className="card-detail-credits">
      Carta di {info.game}. Immagini, dati e prezzi di mercato dal catalogo{' '}
      <a href="https://www.tcgplayer.com" target="_blank" rel="noopener noreferrer">TCGplayer</a>{' '}
      tramite <a href="https://tcgcsv.com" target="_blank" rel="noopener noreferrer">tcgcsv.com</a>.
      {' '}{info.rights}
      {' '}VinylDex è un progetto didattico non ufficiale, non affiliato né approvato dai titolari dei diritti.
    </p>
  );
}
