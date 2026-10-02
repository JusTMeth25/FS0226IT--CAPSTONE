/**
 * Dorsi dei giochi da cui arrivano le carte importate, salvati in locale cosi' funzionano anche
 * offline. Li usano la carta 3D (retro) e i pacchetti di un solo gioco (grafica del pacchetto).
 * Le carte VinylDex usano il dorso VinylDex disegnato su canvas.
 */
export const CARD_BACKS = {
  pokemon: '/assets/img/backs/pokemon.jpg',
  scryfall: '/assets/img/backs/scryfall.jpg',
  yugioh: '/assets/img/backs/yugioh.jpg',
  onepiece: '/assets/img/backs/onepiece.jpg',
  digimon: '/assets/img/backs/digimon.jpg',
  lorcana: '/assets/img/backs/lorcana.png',
  riftbound: '/assets/img/backs/riftbound.png',
  // Dorso disegnato da noi, come quello di FC 27: niente logo ufficiale di Union Arena.
  nikke: '/assets/img/backs/nikke.svg',
  // Dorsi disegnati da noi per i giochi dal catalogo TCGplayer.
  cyberpunk: '/assets/img/backs/cyberpunk.svg',
  hololive: '/assets/img/backs/hololive.svg',
  unionarena: '/assets/img/backs/unionarena.svg',
  shadowverse: '/assets/img/backs/shadowverse.svg',
  wixoss: '/assets/img/backs/wixoss.svg',
  grandarchive: '/assets/img/backs/grandarchive.svg',
  weiss: '/assets/img/backs/weiss.svg',
  vanguard: '/assets/img/backs/vanguard.svg',
  dragonball: '/assets/img/backs/dragonball.png',
  gundam: '/assets/img/backs/gundam.jpg',
  // Dorso in stile Ultimate Team disegnato da noi: le carte UT non hanno un retro ufficiale.
  fc27: '/assets/img/backs/fc27.svg',
  // Le carte giapponesi e le promo hanno lo stesso dorso Pokémon.
  pokemonjp: '/assets/img/backs/pokemon.jpg',
  pokemonpromo: '/assets/img/backs/pokemon.jpg',
  // Dorso disegnato da noi: niente loghi NBA o dei produttori di carte.
  nba: '/assets/img/backs/nba.svg'
};
