import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { AdditiveBlending, BackSide, CanvasTexture, DoubleSide, FrontSide, PlaneGeometry, RepeatWrapping, SRGBColorSpace, ShaderMaterial } from 'three';
import { BASE_URL } from '../../services/apiClient.js';
import { resolveCardImage } from '../../utils/cardUtils.js';
import { gradeInfo, gradeTone } from '../../utils/gradeUtils.js';
import { coverBack, drawCover, drawPageBackground } from './binderThemes.js';
import { isLiteDevice, sceneDpr } from '../../utils/perfMode.js';
import { useDocumentVisible } from '../three/useThreeEnabled.js';

/** Misure del libro (unita' di scena) e della texture di una pagina (pixel). */
const W = 3;
const H = 4.15;
const SEG = 32;
const TEX_W = 768;
const TEX_H = 1062;
const MARGIN_X = 40;
const MARGIN_Y = 52;
const GAP = 18;
const POCKET_W = (TEX_W - MARGIN_X * 2 - GAP * 2) / 3;
const POCKET_H = (TEX_H - MARGIN_Y * 2 - GAP * 2) / 3;
const TURN_MS = 950;
const OPEN_MS = 1400;

/** Le immagini esterne passano dal backend, cosi' il canvas non resta "sporco" per WebGL. */
function imageUrl(card) {
  const url = resolveCardImage(card);
  if (!/^https?:\/\//.test(url)) return url;
  return `${BASE_URL}/cards/${encodeURIComponent(card.id)}/image`;
}

const imageCache = new Map();
function loadImage(url, onLoad) {
  let entry = imageCache.get(url);
  if (!entry) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    entry = { img, ready: false, listeners: new Set() };
    img.onload = () => {
      entry.ready = true;
      entry.listeners.forEach((fn) => fn());
      entry.listeners.clear();
    };
    img.src = url;
    imageCache.set(url, entry);
  }
  if (!entry.ready && onLoad) entry.listeners.add(onLoad);
  return entry.ready ? entry.img : null;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Altezza dell'etichetta del cofanetto del perito dentro la tasca (pixel della texture). */
const SLAB_LABEL = 52;
const TONES = {
  gold: ['#fde68a', '#b45309'],
  silver: ['#e5e7eb', '#475569'],
  bronze: ['#fed7aa', '#9a3412']
};

/** Riquadro della tasca i (0-8) sulla pagina, in pixel della texture. */
function pocketRect(i) {
  return { x: MARGIN_X + (i % 3) * (POCKET_W + GAP), y: MARGIN_Y + Math.floor(i / 3) * (POCKET_H + GAP) };
}

/** Dove sta l'immagine della carta nella tasca: piena, oppure piu' piccola sotto l'etichetta del cofanetto. */
function cardRect(i, graded) {
  const { x, y } = pocketRect(i);
  if (!graded) return { ix: x + 8, iy: y + 8, iw: POCKET_W - 16, ih: POCKET_H - 16 };
  const ih = POCKET_H - SLAB_LABEL - 30;
  const iw = Math.round(ih * 0.716);
  return { ix: x + (POCKET_W - iw) / 2, iy: y + SLAB_LABEL + 18, iw, ih };
}

/** Cofanetto del perito disegnato nella tasca: plastica trasparente, etichetta con il voto. */
function drawSlab(ctx, i, card) {
  const { x, y } = pocketRect(i);
  const [light, dark] = TONES[gradeTone(card.grade)];
  // Guscio di plastica con il bordo chiaro.
  roundRect(ctx, x + 4, y + 4, POCKET_W - 8, POCKET_H - 8, 10);
  ctx.fillStyle = 'rgba(220,230,255,.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Etichetta: marca, nome, voto nel riquadro colorato.
  roundRect(ctx, x + 10, y + 10, POCKET_W - 20, SLAB_LABEL, 5);
  ctx.fillStyle = '#f7f5ee';
  ctx.fill();
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x + 10, y + 10, POCKET_W - 20, 13);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VINYLDEX GRADING', x + 15, y + 20);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 13px Arial, sans-serif';
  const name = (card.name || '').length > 17 ? `${card.name.slice(0, 16)}…` : (card.name || '');
  ctx.fillText(name, x + 15, y + 39);
  ctx.font = '10px Arial, sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.fillText(gradeInfo(card.grade).label, x + 15, y + 54);
  const bx = x + POCKET_W - 56;
  const grad = ctx.createLinearGradient(bx, y + 25, bx, y + 60);
  grad.addColorStop(0, light);
  grad.addColorStop(1, dark);
  roundRect(ctx, bx, y + 25, 40, 35, 4);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(card.grade), bx + 20, y + 52);
  // Culla scura attorno alla carta.
  const r = cardRect(i, true);
  roundRect(ctx, r.ix - 5, r.iy - 5, r.iw + 10, r.ih + 10, 8);
  ctx.fillStyle = '#0f1222';
  ctx.fill();
}

/** Arcobaleno olografico fisso sulla carta (quello che si muove lo aggiunge FoilSheen sopra). */
function drawFoil(ctx, { ix, iy, iw, ih }) {
  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, 8);
  ctx.clip();
  ctx.globalCompositeOperation = 'color-dodge';
  const g = ctx.createLinearGradient(ix, iy + ih, ix + iw, iy);
  const colors = ['rgba(255,0,128,.42)', 'rgba(255,220,0,.42)', 'rgba(0,255,170,.42)', 'rgba(0,170,255,.42)', 'rgba(170,0,255,.42)'];
  colors.forEach((c, k) => g.addColorStop(k / (colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, ih);
  ctx.globalCompositeOperation = 'source-over';
  // Etichetta "Olo" nell'angolo.
  roundRect(ctx, ix + 6, iy + 6, 38, 17, 8);
  const chip = ctx.createLinearGradient(ix + 6, 0, ix + 44, 0);
  ['#ff9ad5', '#ffe27a', '#8dffd9', '#8fd3ff', '#d9a2ff'].forEach((c, k) => chip.addColorStop(k / 4, c));
  ctx.fillStyle = chip;
  ctx.fill();
  ctx.fillStyle = '#1a1030';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OLO', ix + 25, iy + 19);
  ctx.restore();
}

/** Disegna una pagina: fondo del gioco, nove tasche di plastica, le carte (o le sagome). */
function paintPage(canvas, cards, theme, number, onImage) {
  const ctx = canvas.getContext('2d');
  drawPageBackground(ctx, TEX_W, TEX_H, theme);
  for (let i = 0; i < 9; i += 1) {
    const { x, y } = pocketRect(i);
    roundRect(ctx, x, y, POCKET_W, POCKET_H, 10);
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.fill();
    ctx.strokeStyle = theme.pocket;
    ctx.lineWidth = 3;
    ctx.stroke();
    const card = cards?.[i];
    if (!card) continue;
    const graded = card.owned && card.grade > 0;
    if (graded) drawSlab(ctx, i, card);
    const img = loadImage(imageUrl(card), onImage);
    const rect = cardRect(i, graded);
    const { ix, iy, iw, ih } = rect;
    if (img) {
      ctx.save();
      roundRect(ctx, ix, iy, iw, ih, 8);
      ctx.clip();
      const k = Math.max(iw / img.width, ih / img.height);
      ctx.drawImage(img, ix + (iw - img.width * k) / 2, iy + (ih - img.height * k) / 2, img.width * k, img.height * k);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(ix, iy, iw, ih);
    }
    if (!card.owned) {
      // Carta che manca: sagoma scura con il numero, come uno spazio vuoto dell'album.
      ctx.fillStyle = 'rgba(8,8,16,.78)';
      roundRect(ctx, ix, iy, iw, ih, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.number ? `#${card.number}` : '?', x + POCKET_W / 2, y + POCKET_H / 2);
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText((card.name || '').slice(0, 22), x + POCKET_W / 2, y + POCKET_H / 2 + 28);
    } else if (card.foil > 0) {
      drawFoil(ctx, rect);
    }
    // Riflesso della bustina di plastica.
    const glare = ctx.createLinearGradient(x, y, x + POCKET_W, y + POCKET_H);
    glare.addColorStop(0.2, 'rgba(255,255,255,0)');
    glare.addColorStop(0.35, 'rgba(255,255,255,.16)');
    glare.addColorStop(0.45, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    roundRect(ctx, x, y, POCKET_W, POCKET_H, 10);
    ctx.fill();
  }
  ctx.fillStyle = theme.text;
  ctx.globalAlpha = 0.6;
  ctx.font = '22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(number), TEX_W / 2, TEX_H - 16);
  ctx.globalAlpha = 1;
}

/** Pagine tenute in memoria come texture: le altre si ridisegnano quando si torna li'. */
const MAX_PAGE_TEXTURES = 14;

/** Cosa c'e' su una pagina: cambia quando arrivano le carte o se ne trova una nuova. */
const pageSignature = (cards) => (cards ? cards.map((c) => `${c.id}:${c.owned ? 1 : 0}:${c.grade || 0}`).join('|') : null);

/**
 * Texture delle pagine di un raccoglitore: create quando servono e ridisegnate quando arrivano
 * le immagini delle carte. Ogni pagina ha anche la versione specchiata (il retro del foglio).
 * Le carte arrivano a blocchi (una pagina non ancora caricata e' null): quando arrivano, le
 * pagine gia' disegnate vuote si ridisegnano. Si tengono solo le pagine usate di recente: con
 * cataloghi di migliaia di carte sfogliare tutto il libro non deve riempire la memoria del telefono.
 */
class PageTextures {
  constructor(pages, theme) {
    this.pages = pages;
    this.theme = theme;
    this.cache = new Map();
  }

  /** Nuove pagine (blocchi di carte arrivati): si ridisegnano quelle cambiate. */
  update(pages) {
    const old = this.pages;
    this.pages = pages;
    this.cache.forEach((entry, index) => {
      if (pageSignature(old[index]) !== pageSignature(pages[index])) entry.repaint();
    });
  }

  get(index, mirrored = false) {
    if (index < 0 || index >= this.pages.length) return null;
    let entry = this.cache.get(index);
    if (entry) {
      // Usata di recente: in fondo alla coda.
      this.cache.delete(index);
      this.cache.set(index, entry);
    }
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = TEX_W;
      canvas.height = TEX_H;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      const flipped = texture.clone();
      flipped.wrapS = RepeatWrapping;
      flipped.repeat.x = -1;
      flipped.offset.x = 1;
      const repaint = () => {
        paintPage(canvas, this.pages[index], this.theme, index + 1, repaint);
        texture.needsUpdate = true;
        flipped.needsUpdate = true;
      };
      repaint();
      entry = { texture, flipped, repaint };
      this.cache.set(index, entry);
      this.trim();
    }
    return mirrored ? entry.flipped : entry.texture;
  }

  /** Butta le texture usate meno di recente oltre il limite. */
  trim() {
    while (this.cache.size > MAX_PAGE_TEXTURES) {
      const [oldest, entry] = this.cache.entries().next().value;
      entry.texture.dispose();
      entry.flipped.dispose();
      this.cache.delete(oldest);
    }
  }

  dispose() {
    this.cache.forEach(({ texture, flipped }) => { texture.dispose(); flipped.dispose(); });
    this.cache.clear();
  }
}

function useCoverTexture(theme) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1400;
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    // Quando arriva il dorso ufficiale (Pokemon, Yu-Gi-Oh!, Magic) la copertina si ridisegna.
    const paint = () => {
      drawCover(canvas, theme);
      t.needsUpdate = true;
    };
    coverBack(theme, paint);
    paint();
    return t;
  }, [theme]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Tasca cliccata: dalla coordinata uv della pagina al numero della carta (0-8). */
function pocketAt(uv) {
  const x = uv.x * TEX_W;
  const y = (1 - uv.y) * TEX_H;
  const col = Math.floor((x - MARGIN_X) / (POCKET_W + GAP));
  const row = Math.floor((y - MARGIN_Y) / (POCKET_H + GAP));
  if (col < 0 || col > 2 || row < 0 || row > 2) return -1;
  return row * 3 + col;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Riflesso olografico che si muove sopra le carte foil delle due pagine aperte, come nella
 * collezione: una banda arcobaleno che scorre nel tempo e cambia girando il libro.
 */
function createSheenMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uView: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uView;
      varying vec2 vUv;
      void main() {
        float band = vUv.x * 0.9 + (1.0 - vUv.y) * 0.6 - uTime * 0.28 + uView * 0.8;
        vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (band * 1.4 + vec3(0.0, 0.33, 0.67)));
        float sweep = pow(0.5 + 0.5 * sin(band * 6.28318), 6.0);
        float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) * smoothstep(0.0, 0.03, vUv.y) * smoothstep(1.0, 0.97, vUv.y);
        float sparkle = step(0.985, fract(sin(dot(floor(vUv * vec2(40.0, 56.0)), vec2(12.9898, 78.233))) * 43758.5453))
          * pow(0.5 + 0.5 * sin(uTime * 3.0 + vUv.x * 50.0), 6.0);
        vec3 col = rainbow * (0.07 + 0.28 * sweep) + vec3(sparkle * 0.45);
        gl_FragColor = vec4(col * edge, 1.0);
      }
    `
  });
}

/** Tempo e punto di vista del riflesso (fuori dal componente: il materiale e' condiviso). */
function setSheen(material, time, view) {
  material.uniforms.uTime.value = time;
  material.uniforms.uView.value = view;
}

function FoilSheen({ cards, side }) {
  const [material] = useState(createSheenMaterial);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => setSheen(material, state.clock.elapsedTime, state.camera.position.x * 0.25 + state.camera.position.y * 0.1));
  const foils = (cards || []).map((card, i) => ({ card, i })).filter(({ card }) => card?.owned && card.foil > 0);
  if (!foils.length) return null;
  return foils.map(({ card, i }) => {
    const { ix, iy, iw, ih } = cardRect(i, card.grade > 0);
    const cx = ((ix + iw / 2) / TEX_W - 0.5) * W + (side > 0 ? W / 2 : -W / 2);
    const cy = (0.5 - (iy + ih / 2) / TEX_H) * H;
    return (
      <mesh key={card.id} position={[cx, cy, 0.012]} material={material} raycast={() => null}>
        <planeGeometry args={[(iw / TEX_W) * W, (ih / TEX_H) * H]} />
      </mesh>
    );
  });
}

/** Il foglio che gira: una striscia di SEG colonne piegata lungo un arco. */
function Leaf({ front, back, progress, dir }) {
  const [geometry] = useState(() => new PlaneGeometry(W, H, SEG, 1));
  const frontRef = useRef(null);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const g = frontRef.current?.geometry;
    if (!g) return;
    const a = progress.current;
    const lift = Math.sin(a * Math.PI);
    const seg = W / SEG;
    const xs = [0];
    const zs = [0];
    for (let k = 1; k <= SEG; k += 1) {
      // Il bordo esterno resta indietro rispetto al dorso: la pagina si incurva come carta vera.
      const lag = lift * 0.6 * (k / SEG) * dir;
      const angle = Math.min(Math.PI, Math.max(0, a * Math.PI - lag));
      xs.push(xs[k - 1] + Math.cos(angle) * seg);
      zs.push(zs[k - 1] + Math.sin(angle) * seg);
    }
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const k = i % (SEG + 1);
      pos.setX(i, xs[k]);
      pos.setZ(i, zs[k] + 0.02 + lift * 0.02);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  });
  return (
    <group>
      <mesh ref={frontRef} geometry={geometry}>
        <meshStandardMaterial map={front} side={FrontSide} roughness={0.75} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial map={back} side={BackSide} roughness={0.75} />
      </mesh>
    </group>
  );
}

/** Cursore del canvas (mano aperta sugli angoli delle pagine, chiusa mentre si trascina). */
function setCursor(element, cursor) {
  if (element) element.style.cursor = cursor;
}

/** Quanto si trascina (in frazioni della larghezza del canvas) per girare del tutto una pagina. */
const DRAG_FULL = 0.38;
/** Pixel verso il dorso oltre i quali una pressione diventa trascinamento della pagina. */
const DRAG_START = 12;
/** Oltre questa frazione del giro, lasciando la pagina finisce di girare; sotto, ricade. */
const DRAG_COMMIT = 0.3;
/** Meta' esterna della pagina (coordinate uv): da li' si afferra il foglio; dal centro si gira il libro. */
const CORNER_UV = 0.6;

function Book({ pages, theme, spread, onCard, onSettled, onTurned, controlsRef }) {
  const [store] = useState(() => new PageTextures(pages, theme));
  useEffect(() => () => store.dispose(), [store]);
  useEffect(() => { store.update(pages); }, [store, pages]);
  const pageTexture = (index, mirrored) => store.get(index, mirrored);
  const cover = useCoverTexture(theme);
  const [shown, setShown] = useState(spread);
  const [turning, setTurning] = useState(null);
  const progress = useRef(0);
  // Animazione del foglio: da quale punto a quale, da quando, e se alla fine la pagina cambia.
  const anim = useRef(null);
  // Pagina afferrata con il dito o il mouse: il foglio segue il trascinamento.
  const drag = useRef(null);
  const lastGrab = useRef(0);
  const openRef = useRef(null);
  const openStart = useRef(0);
  const { gl } = useThree();
  const maxSpread = Math.ceil(pages.length / 2) - 1;

  useEffect(() => {
    openStart.current = performance.now();
  }, []);

  // Doppia pagina da raggiungere. Segue il valore che arriva da fuori solo quando cambia davvero:
  // dopo una pagina sfogliata col dito il libro e' gia' avanti mentre il valore di fuori si
  // aggiorna un attimo dopo, e senza questo il libro tornerebbe indietro e poi di nuovo avanti.
  const target = useRef(spread);
  useEffect(() => {
    target.current = spread;
  }, [spread]);

  // Un passo alla volta verso la doppia pagina chiesta (anche se si salta di piu' pagine).
  useEffect(() => {
    const goal = target.current;
    if (turning || drag.current || goal === shown) return undefined;
    const frame = requestAnimationFrame(() => {
      const dir = goal > shown ? 1 : -1;
      progress.current = dir > 0 ? 0 : 1;
      anim.current = { from: progress.current, to: dir > 0 ? 1 : 0, start: performance.now(), commit: true };
      setTurning(dir);
    });
    return () => cancelAnimationFrame(frame);
  }, [spread, shown, turning]);

  useFrame(() => {
    const now = performance.now();
    if (openRef.current && openStart.current) {
      const t = Math.min(1, (now - openStart.current) / OPEN_MS);
      openRef.current.rotation.y = Math.PI * (1 - ease(t));
    }
    if (!turning || !anim.current) return;
    const a = anim.current;
    const t = Math.min(1, (now - a.start) / (TURN_MS * Math.max(0.25, Math.abs(a.to - a.from))));
    progress.current = a.from + (a.to - a.from) * ease(t);
    if (t >= 1) {
      anim.current = null;
      if (a.commit) {
        const next = shown + turning;
        // Sfogliata col dito: questa e' ora la pagina da tenere, qualunque cosa arrivi da fuori.
        if (a.manual) target.current = next;
        setShown(next);
        onTurned?.(next);
      }
      setTurning(null);
      onSettled?.();
    }
  });

  /**
   * Si afferra l'angolo esterno di una pagina e la si trascina verso il dorso: il foglio segue il
   * dito. Lasciandolo oltre un terzo del giro la pagina gira, altrimenti ricade al suo posto.
   * Intanto la rotazione del libro e' ferma, per non muovere tutto insieme.
   */
  /**
   * Premendo sulla meta' esterna di una pagina non succede ancora niente: il foglio si afferra solo
   * se il puntatore si sposta verso il dorso di qualche pixel. Un clic fermo resta un clic, cosi'
   * le carte ai bordi si aprono come le altre.
   */
  const grab = (dir, event) => {
    if (turning || drag.current) return;
    const uvX = event.uv?.x ?? 0;
    const onCorner = dir > 0 ? uvX > CORNER_UV : uvX < 1 - CORNER_UV;
    if (!onCorner) return;
    if (dir > 0 ? shown >= maxSpread : shown <= 0) return;
    // Il libro non ruota mentre si decide se e' un clic o un trascinamento della pagina.
    if (controlsRef?.current) controlsRef.current.enabled = false;
    const width = gl.domElement.clientWidth || 600;
    drag.current = { dir, startX: event.clientX, startY: event.clientY, width, f: 0, active: false };
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) * -d.dir;
      if (!d.active) {
        const dy = Math.abs(e.clientY - d.startY);
        // In su, in giu' o verso l'esterno non e' sfogliare: si lascia girare il libro.
        if (dy > DRAG_START || dx < -DRAG_START) {
          drag.current = null;
          if (controlsRef?.current) controlsRef.current.enabled = true;
          return;
        }
        // Trascinamento vero: almeno DRAG_START pixel verso il dorso, piu' in orizzontale che in verticale.
        if (dx < DRAG_START || dy > dx) return;
        d.active = true;
        d.startX = e.clientX - d.dir * -DRAG_START;
        lastGrab.current = performance.now();
        progress.current = d.dir > 0 ? 0 : 1;
        anim.current = null;
        setTurning(d.dir);
        setCursor(gl.domElement, 'grabbing');
      }
      d.f = Math.max(0, Math.min(1, dx / (d.width * DRAG_FULL)));
      progress.current = d.dir > 0 ? d.f : 1 - d.f;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setCursor(gl.domElement, '');
      if (controlsRef?.current) controlsRef.current.enabled = true;
      const d = drag.current;
      drag.current = null;
      if (!d || !d.active) return;
      lastGrab.current = performance.now();
      const commit = d.f > DRAG_COMMIT;
      anim.current = { from: progress.current, to: (d.dir > 0) === commit ? 1 : 0, start: performance.now(), commit, manual: true };
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  // Sopra una carta la manina del clic; nella parte esterna senza carta la mano per afferrare.
  const hover = (index, dir, event) => {
    if (turning) return;
    const uvX = event.uv?.x ?? 0;
    const onCorner = dir > 0 ? uvX > CORNER_UV : uvX < 1 - CORNER_UV;
    const onCard = pages[index]?.[pocketAt(event.uv)] != null;
    setCursor(gl.domElement, onCard ? 'pointer' : onCorner ? 'grab' : '');
  };
  const leave = () => {
    if (!drag.current) setCursor(gl.domElement, '');
  };

  const s = shown;
  const left = turning === -1 ? 2 * s - 2 : 2 * s;
  const right = turning === 1 ? 2 * s + 3 : 2 * s + 1;
  const leafFront = turning === 1 ? 2 * s + 1 : 2 * s - 1;
  const leafBack = turning === 1 ? 2 * s + 2 : 2 * s;
  const click = (index) => (event) => {
    event.stopPropagation();
    // Dopo aver girato il libro o afferrato un angolo il clic non apre la carta sotto il dito.
    if (event.delta > 6 || performance.now() - lastGrab.current < 300) return;
    const slot = pocketAt(event.uv);
    const card = pages[index]?.[slot];
    if (card) onCard?.(card);
  };
  const leftTex = pageTexture(left);
  const rightTex = pageTexture(right);
  return (
    <group rotation={[-0.62, 0, 0]} position={[0, 0.4, 0]}>
      {/* Retro del libro: la copertina posteriore sotto le pagine di destra. */}
      <mesh position={[W / 2 + 0.06, 0, -0.07]}>
        <boxGeometry args={[W + 0.26, H + 0.34, 0.08]} />
        <meshStandardMaterial color={theme.page} roughness={0.6} />
      </mesh>
      <mesh position={[W / 2 + 0.06, 0, -0.029]}>
        <planeGeometry args={[W + 0.26, H + 0.34]} />
        <meshStandardMaterial map={cover} roughness={0.55} />
      </mesh>
      <mesh position={[W / 2, 0, -0.02]}>
        <boxGeometry args={[W, H, 0.05]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
      </mesh>
      {rightTex && (
        <mesh position={[W / 2, 0, 0.006]} onClick={click(right)} onPointerDown={(e) => grab(1, e)} onPointerMove={(e) => hover(right, 1, e)} onPointerOut={leave}>
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial map={rightTex} roughness={0.75} />
        </mesh>
      )}
      {rightTex && turning !== 1 && <FoilSheen cards={pages[right]} side={1} />}
      {/* Dorso. */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[0.08, H + 0.34, 0.12]} />
        <meshStandardMaterial color={theme.accent} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Lato sinistro: copertina (fuori il motivo del gioco) e pagine; all'inizio si apre. */}
      <group ref={openRef} rotation={[0, Math.PI, 0]}>
        <mesh position={[-W / 2 - 0.06, 0, -0.07]}>
          <boxGeometry args={[W + 0.26, H + 0.34, 0.08]} />
          <meshStandardMaterial color={theme.page} roughness={0.6} />
        </mesh>
        <mesh position={[-W / 2 - 0.06, 0, -0.112]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[W + 0.26, H + 0.34]} />
          <meshStandardMaterial map={cover} roughness={0.55} />
        </mesh>
        <mesh position={[-W / 2 - 0.06, 0, -0.029]}>
          <planeGeometry args={[W + 0.26, H + 0.34]} />
          <meshStandardMaterial map={cover} roughness={0.55} />
        </mesh>
        <mesh position={[-W / 2, 0, -0.02]}>
          <boxGeometry args={[W, H, 0.05]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
        </mesh>
        {leftTex && (
          <mesh position={[-W / 2, 0, 0.006]} onClick={click(left)} onPointerDown={(e) => grab(-1, e)} onPointerMove={(e) => hover(left, -1, e)} onPointerOut={leave}>
            <planeGeometry args={[W, H]} />
            <meshStandardMaterial map={leftTex} roughness={0.75} side={DoubleSide} />
          </mesh>
        )}
        {leftTex && turning !== -1 && <FoilSheen cards={pages[left]} side={-1} />}
      </group>
      {turning && pageTexture(leafFront) && pageTexture(leafBack, true) && (
        <Leaf front={pageTexture(leafFront)} back={pageTexture(leafBack, true)} progress={progress} dir={turning} />
      )}
    </group>
  );
}

/**
 * Su schermi stretti (telefoni in verticale) la camera si allontana finche' il libro aperto ci
 * sta tutto in larghezza, invece di uscire dai bordi.
 */
function FitCamera({ controlsRef }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    camera.position.set(0, 0, 7.4 * Math.max(1, 1.3 / aspect));
    camera.updateProjectionMatrix();
    controlsRef.current?.saveState?.();
  }, [camera, size.width, size.height, controlsRef]);
  return null;
}

/**
 * Raccoglitore in 3D: il libro si apre, le pagine si sfogliano curvandosi, le carte stanno nelle
 * tasche di plastica. Si comanda da fuori con `spread` (la doppia pagina da mostrare).
 */
export default function BinderBook3D({ pages, theme, spread, onCard, onSettled, onTurned, pagesKey = '' }) {
  const visible = useDocumentVisible();
  const controls = useRef(null);
  // Dispositivi leggeri: niente riflessi d'ambiente, ombra e antialias (meno shader da compilare all'apertura).
  const [lite] = useState(isLiteDevice);
  return (
    <div className="binder-3d">
      <div className="binder-3d-tools">
        <button type="button" className="binder-3d-tool" onClick={() => controls.current?.reset()} title="Rimetti il libro dritto" aria-label="Rimetti il libro dritto">
          <i className="ph-fill ph-arrow-counter-clockwise" />
        </button>
        <span className="binder-3d-hint">Trascina per girare il libro · rotella o due dita per lo zoom · afferra l&apos;angolo di una pagina per sfogliarla</span>
      </div>
      <Canvas
        dpr={sceneDpr()}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 0, 7.4], fov: 42 }}
        gl={{ alpha: true, antialias: !lite, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={lite ? 1.05 : 0.85} />
        <directionalLight position={[-3, 4, 7]} intensity={1.1} />
        {!lite && (
          <Environment resolution={32}>
            <Lightformer form="rect" intensity={1.2} position={[0, 4, 4]} scale={[8, 2, 1]} color="#ffffff" />
          </Environment>
        )}
        <FitCamera controlsRef={controls} />
        <Book key={`${theme.key}:${pagesKey}`} pages={pages} theme={theme} spread={spread} onCard={onCard} onSettled={onSettled}
          onTurned={onTurned} controlsRef={controls} />
        {/* Il libro si gira con il mouse o un dito, si avvicina con la rotella o con due dita. */}
        <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.08}
          minDistance={3.6} maxDistance={16} minPolarAngle={0.45} maxPolarAngle={2.0}
          minAzimuthAngle={-0.85} maxAzimuthAngle={0.85} rotateSpeed={0.7} zoomSpeed={0.8} />
        {/* L'ombra sul piano si calcola nei primi fotogrammi (il libro che si apre) e poi resta: rifarla a ogni fotogramma costa. */}
        {!lite && <ContactShadows frames={90} position={[0, -1.9, -1.2]} rotation={[-0.62 + Math.PI / 2, 0, 0]} opacity={0.4} scale={11} blur={2.8} far={3} />}
      </Canvas>
    </div>
  );
}
