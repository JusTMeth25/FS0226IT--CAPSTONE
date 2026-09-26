import { createCanvas, mirror } from './pixel.js';

/**
 * Animali da compagnia in pixel art, visti di lato e rivolti a destra (a sinistra si specchiano).
 * Il corpo e' uguale nei due fotogrammi; cambiano solo le zampe, cosi' camminando trotterellano.
 */
const BODIES = {
  dog: [
    '...........dd...',
    '..........dbbd..',
    '..........bbbbbn',
    '.d........bebbbb',
    '.bd.......bbbbt.',
    '..bbbbbbbbbbbb..',
    '..bbbbbbbbbbb...',
    '..bwwwwwbbbbb...'
  ],
  cat: [
    '..........o..o..',
    '.o........oooo..',
    '.o........oeoeo.',
    '..o.......ooono.',
    '..o........ooo..',
    '..ooooooooooo...',
    '..osososososo...',
    '..owwwwwwwwoo...'
  ],
  bunny: [
    '...........ww...',
    '...........wpw..',
    '...........wpw..',
    '..........wwww..',
    '..........wewwn.',
    '.ww......wwwww..',
    'wwwwwwwwwwwww...',
    '.wwwwwwwwwwww...'
  ]
};

const LEGS = {
  dog: [['..bb.bb...bb.bb.', '..dd.dd...dd.dd.'], ['...bb.bb...bb.bb', '...dd.dd...dd.dd']],
  cat: [['..oo..oo..oo.oo.', '..ww..ww..ww.ww.'], ['...oo..oo..oo.oo', '...ww..ww..ww.ww']],
  bunny: [['..ww.....ww.ww..', '.www.....ww.ww..'], ['...ww.....ww.ww.', '..www.....ww.ww.']]
};

const PALETTES = {
  dog: { b: '#a8703c', d: '#5a3718', w: '#f2e2c8', e: '#1a1008', n: '#1a1008', t: '#e8607a' },
  cat: { o: '#f0a040', s: '#c06818', w: '#fff4e0', e: '#2a6a2a', n: '#e8607a' },
  bunny: { w: '#f4f0ec', p: '#f0a8b8', e: '#c8203c', n: '#e8607a' }
};

export const PET_W = 16;
export const PET_H = 10;

const cache = new Map();

/** Sprite dell'animale: tipo, fotogramma (0/1) e verso (true = guarda a sinistra). */
export function petSprite(type, frame, left) {
  const key = `${type}:${frame}:${left}`;
  if (cache.has(key)) return cache.get(key);
  const body = BODIES[type] || BODIES.dog;
  const legs = (LEGS[type] || LEGS.dog)[frame % 2];
  const palette = PALETTES[type] || PALETTES.dog;
  const { canvas, ctx } = createCanvas(PET_W, PET_H);
  [...body, ...legs].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || !palette[ch]) return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  const sprite = left ? mirror(canvas) : canvas;
  cache.set(key, sprite);
  return sprite;
}

/** Verso dell'animale: fa un verso ogni tanto (abbaia, miagola). Il coniglio sta zitto. */
export const PET_SOUND = { dog: 'bark', cat: 'meow' };
