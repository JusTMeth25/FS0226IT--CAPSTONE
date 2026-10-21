import { afterEach, describe, expect, it } from 'vitest';
import { BASE_URL } from '../services/apiClient.js';
import { setAccessibility } from '../services/accessibility.js';
import { RARITY_PALETTES } from './rarityPalettes.js';
import {
  BEST_CARD_MIN_RARITY,
  RARITIES,
  RARITY_ORDER,
  cardFinish,
  fcCardImage,
  findBestCardIndex,
  formatCardPrice,
  formatCoins,
  formatMarketPrice,
  getRarityCSSClass,
  getRarityColor,
  getRarityData,
  getRarityIcon,
  getRarityName,
  getSourceLabel,
  getStars,
  getTotalScore,
  placeholderImage,
  resolveCardImage
} from './cardUtils.js';

// Stesso formato del modulo: cosi' il test non dipende dagli spazi speciali che usa Intl.
const usd = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

describe('cardUtils: rarita\'', () => {
  afterEach(() => {
    setAccessibility({ cvd: '' });
  });

  it.each([
    ['common', 'Comune', 1, '#9CA3AF'],
    ['uncommon', 'Non Comune', 2, '#4CAF50'],
    ['rare', 'Rara', 3, '#2196F3'],
    ['epic', 'Epica', 4, '#8B5CF6'],
    ['legendary', 'Leggendaria', 5, '#FFD700']
  ])('%s: nome %s, %i stelle, colore %s', (rarity, name, stars, color) => {
    expect(getRarityName(rarity)).toBe(name);
    expect(getStars(rarity)).toBe(stars);
    expect(getRarityColor(rarity)).toBe(color);
    expect(getRarityData(rarity)).toBe(RARITIES[rarity]);
  });

  it('una rarita\' sconosciuta vale come comune', () => {
    expect(getRarityName('mitica')).toBe('Comune');
    expect(getRarityColor(undefined)).toBe('#9CA3AF');
    expect(getStars(null)).toBe(1);
    expect(getRarityIcon('mitica')).toBe('/common.svg');
  });

  it('icona e classe CSS seguono la rarita\'', () => {
    expect(getRarityIcon('epic')).toBe('/epic.svg');
    expect(getRarityCSSClass('rare')).toBe('card-rarity-rare');
  });

  it.each(['rg', 'by', 'mono'])('modalita\' daltonismo %s: colori dalla sua palette', (cvd) => {
    setAccessibility({ cvd });
    Object.keys(RARITIES).forEach((rarity) => {
      expect(getRarityColor(rarity)).toBe(RARITY_PALETTES[cvd][rarity]);
    });
    // Le rarita' sconosciute valgono comune anche nella palette.
    expect(getRarityColor('mitica')).toBe(RARITY_PALETTES[cvd].common);
    // Il nome non cambia con la palette.
    expect(getRarityName('legendary')).toBe('Leggendaria');
  });

  it('tornando a nessun daltonismo si riprendono i colori normali', () => {
    setAccessibility({ cvd: 'rg' });
    expect(getRarityColor('rare')).toBe(RARITY_PALETTES.rg.rare);
    setAccessibility({ cvd: '' });
    expect(getRarityColor('rare')).toBe('#2196F3');
  });
});

describe('cardUtils: provenienza e prezzi', () => {
  it('etichetta della fonte nota, altrimenti il codice stesso', () => {
    expect(getSourceLabel('pokemon')).toBe('Pokémon TCG');
    expect(getSourceLabel('original')).toBe('VinylDex');
    expect(getSourceLabel('sconosciuta')).toBe('sconosciuta');
  });

  it('prezzo di mercato in dollari solo se positivo', () => {
    expect(formatMarketPrice(12.5)).toBe(usd(12.5));
    expect(formatMarketPrice(0)).toBeNull();
    expect(formatMarketPrice(-3)).toBeNull();
    expect(formatMarketPrice(undefined)).toBeNull();
  });

  it('crediti FC 27 con il separatore delle migliaia italiano (dalle cinque cifre)', () => {
    expect(formatCoins(1500)).toBe('1500 crediti');
    expect(formatCoins(1750000)).toBe('1.750.000 crediti');
    expect(formatCoins(0)).toBeNull();
    expect(formatCoins(null)).toBeNull();
  });

  it('formatCardPrice: crediti con l\'equivalente in dollari, solo crediti, solo dollari, niente', () => {
    expect(formatCardPrice({ coinPrice: 10000, marketPrice: 2 })).toBe(`10.000 crediti (≈ ${usd(2)})`);
    expect(formatCardPrice({ coinPrice: 10000 })).toBe('10.000 crediti');
    expect(formatCardPrice({ marketPrice: 3.25 })).toBe(usd(3.25));
    expect(formatCardPrice({})).toBeNull();
    expect(formatCardPrice(null)).toBeNull();
  });
});

describe('cardUtils: punteggio e immagini', () => {
  it('getTotalScore somma le quattro statistiche', () => {
    expect(getTotalScore({ stats: { fans: 10, style: 20, influence: 30, energy: 40 } })).toBe(100);
  });

  it('getTotalScore con statistiche mancanti conta zero', () => {
    expect(getTotalScore({ stats: { fans: 5 } })).toBe(5);
    expect(getTotalScore({})).toBe(0);
  });

  it('resolveCardImage usa l\'immagine della carta se c\'e\'', () => {
    expect(resolveCardImage({ id: 'x', img: 'https://cdn/x.png', rarity: 'rare' })).toBe('https://cdn/x.png');
    expect(resolveCardImage({ id: 'fc1', source: 'fc27', img: '/foto.png' })).toBe('/foto.png');
  });

  it('resolveCardImage: carte FC 27 e NBA senza immagine disegnate dal backend', () => {
    expect(resolveCardImage({ id: 'fc 1', source: 'fc27' })).toBe(`${BASE_URL}/cards/fc%201/fc-card.svg?v=2`);
    expect(fcCardImage({ id: 'fc 1' })).toBe(`${BASE_URL}/cards/fc%201/fc-card.svg?v=2`);
    expect(resolveCardImage({ id: 'nba/7', source: 'nba' })).toBe(`${BASE_URL}/cards/nba%2F7/nba-card.svg?v=2`);
  });

  it('resolveCardImage senza immagine: segnaposto SVG con colore della rarita\' e iniziale', () => {
    const url = resolveCardImage({ id: 'c1', name: 'vinile', rarity: 'rare' });
    expect(url).toBe(placeholderImage({ name: 'vinile', rarity: 'rare' }));
    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    expect(url).toContain('%232196F3');
    expect(url).toContain('%3EV%3C/text%3E');
  });

  it('segnaposto senza nome usa il punto interrogativo', () => {
    expect(placeholderImage({ rarity: 'common' })).toContain('%3E?%3C/text%3E');
  });
});

describe('cardUtils: finitura e carta migliore', () => {
  it('cardFinish: quella del backend ha la precedenza', () => {
    expect(cardFinish({ finish: 'holo', rarity: 'common' })).toBe('holo');
    expect(cardFinish({ finish: null, rarity: 'legendary' })).toBeNull();
  });

  it('cardFinish dedotta dalla rarita\' e dalla fonte', () => {
    expect(cardFinish(null)).toBeNull();
    expect(cardFinish({ source: 'pokemonjp', rarity: 'legendary' })).toBeNull();
    expect(cardFinish({ rarity: 'legendary' })).toBe('illustration');
    expect(cardFinish({ source: 'scryfall', rarity: 'legendary' })).toBe('secret');
    expect(cardFinish({ source: 'original', rarity: 'epic' })).toBe('ultra');
    expect(cardFinish({ source: 'pokemon', rarity: 'rare', foil: 1 })).toBe('reverse');
    expect(cardFinish({ source: 'yugioh', rarity: 'rare', foil: 1 })).toBe('holo');
    expect(cardFinish({ source: 'yugioh', rarity: 'rare', foil: 0 })).toBeNull();
  });

  it('findBestCardIndex trova la piu\' rara, a parita\' la prima', () => {
    const cards = [{ rarity: 'common' }, { rarity: 'epic' }, { rarity: 'rare' }, { rarity: 'epic' }];
    expect(findBestCardIndex(cards)).toBe(1);
  });

  it('findBestCardIndex: -1 se nessuna raggiunge la soglia o se l\'elenco manca', () => {
    expect(BEST_CARD_MIN_RARITY).toBe(RARITY_ORDER.rare);
    expect(findBestCardIndex([{ rarity: 'common' }, { rarity: 'uncommon' }])).toBe(-1);
    expect(findBestCardIndex([])).toBe(-1);
    expect(findBestCardIndex(null)).toBe(-1);
    expect(findBestCardIndex([{ rarity: 'sconosciuta' }, { rarity: 'legendary' }])).toBe(1);
  });
});
