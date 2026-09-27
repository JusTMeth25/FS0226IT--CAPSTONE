import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { BackSide, CanvasTexture, DoubleSide, FrontSide, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three';
import { BASE_URL } from '../../services/apiClient.js';
import { resolveCardImage } from '../../utils/cardUtils.js';
import { coverBack, drawCover, drawPageBackground } from './binderThemes.js';
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

/** Disegna una pagina: fondo del gioco, nove tasche di plastica, le carte (o le sagome). */
function paintPage(canvas, cards, theme, number, onImage) {
  const ctx = canvas.getContext('2d');
  drawPageBackground(ctx, TEX_W, TEX_H, theme);
  for (let i = 0; i < 9; i += 1) {
    const x = MARGIN_X + (i % 3) * (POCKET_W + GAP);
    const y = MARGIN_Y + Math.floor(i / 3) * (POCKET_H + GAP);
    roundRect(ctx, x, y, POCKET_W, POCKET_H, 10);
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.fill();
    ctx.strokeStyle = theme.pocket;
    ctx.lineWidth = 3;
    ctx.stroke();
    const card = cards?.[i];
    if (!card) continue;
    const img = loadImage(imageUrl(card), onImage);
    const ix = x + 8;
    const iy = y + 8;
    const iw = POCKET_W - 16;
    const ih = POCKET_H - 16;
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
      const g = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
      g.addColorStop(0, 'rgba(255,0,128,.18)');
      g.addColorStop(0.5, 'rgba(0,255,200,.18)');
      g.addColorStop(1, 'rgba(120,0,255,.18)');
      ctx.fillStyle = g;
      ctx.fillRect(ix, iy, iw, ih);
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

/**
 * Texture delle pagine di un raccoglitore: create quando servono e ridisegnate quando arrivano
 * le immagini delle carte. Ogni pagina ha anche la versione specchiata (il retro del foglio).
 */
class PageTextures {
  constructor(pages, theme) {
    this.pages = pages;
    this.theme = theme;
    this.cache = new Map();
  }

  get(index, mirrored = false) {
    if (index < 0 || index >= this.pages.length) return null;
    let entry = this.cache.get(index);
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
      entry = { texture, flipped };
      this.cache.set(index, entry);
    }
    return mirrored ? entry.flipped : entry.texture;
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

function Book({ pages, theme, spread, onCard, onSettled }) {
  const [store] = useState(() => new PageTextures(pages, theme));
  useEffect(() => () => store.dispose(), [store]);
  const pageTexture = (index, mirrored) => store.get(index, mirrored);
  const cover = useCoverTexture(theme);
  const [shown, setShown] = useState(spread);
  const [turning, setTurning] = useState(null);
  const progress = useRef(0);
  const turnStart = useRef(0);
  const openRef = useRef(null);
  const openStart = useRef(0);

  useEffect(() => {
    openStart.current = performance.now();
  }, []);

  // Un passo alla volta verso la doppia pagina chiesta (anche se si salta di piu' pagine).
  useEffect(() => {
    if (turning || spread === shown) return undefined;
    const frame = requestAnimationFrame(() => {
      turnStart.current = performance.now();
      progress.current = spread > shown ? 0 : 1;
      setTurning(spread > shown ? 1 : -1);
    });
    return () => cancelAnimationFrame(frame);
  }, [spread, shown, turning]);

  useFrame(() => {
    const now = performance.now();
    if (openRef.current && openStart.current) {
      const t = Math.min(1, (now - openStart.current) / OPEN_MS);
      openRef.current.rotation.y = Math.PI * (1 - ease(t));
    }
    if (!turning) return;
    const t = Math.min(1, (now - turnStart.current) / TURN_MS);
    progress.current = turning > 0 ? ease(t) : 1 - ease(t);
    if (t >= 1) {
      setShown((s) => s + turning);
      setTurning(null);
      onSettled?.();
    }
  });

  const s = shown;
  const left = turning === -1 ? 2 * s - 2 : 2 * s;
  const right = turning === 1 ? 2 * s + 3 : 2 * s + 1;
  const leafFront = turning === 1 ? 2 * s + 1 : 2 * s - 1;
  const leafBack = turning === 1 ? 2 * s + 2 : 2 * s;
  const click = (index) => (event) => {
    event.stopPropagation();
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
        <mesh position={[W / 2, 0, 0.006]} onClick={click(right)}>
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial map={rightTex} roughness={0.75} />
        </mesh>
      )}
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
          <mesh position={[-W / 2, 0, 0.006]} onClick={click(left)}>
            <planeGeometry args={[W, H]} />
            <meshStandardMaterial map={leftTex} roughness={0.75} side={DoubleSide} />
          </mesh>
        )}
      </group>
      {turning && pageTexture(leafFront) && pageTexture(leafBack, true) && (
        <Leaf front={pageTexture(leafFront)} back={pageTexture(leafBack, true)} progress={progress} dir={turning} />
      )}
    </group>
  );
}

/**
 * Raccoglitore in 3D: il libro si apre, le pagine si sfogliano curvandosi, le carte stanno nelle
 * tasche di plastica. Si comanda da fuori con `spread` (la doppia pagina da mostrare).
 */
export default function BinderBook3D({ pages, theme, spread, onCard, onSettled, pagesKey = '' }) {
  const visible = useDocumentVisible();
  return (
    <div className="binder-3d">
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 0, 7.4], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[-3, 4, 7]} intensity={1.1} />
        <Environment resolution={32}>
          <Lightformer form="rect" intensity={1.2} position={[0, 4, 4]} scale={[8, 2, 1]} color="#ffffff" />
        </Environment>
        <Book key={`${theme.key}:${pagesKey}`} pages={pages} theme={theme} spread={spread} onCard={onCard} onSettled={onSettled} />
        <ContactShadows position={[0, -1.9, -1.2]} rotation={[-0.62 + Math.PI / 2, 0, 0]} opacity={0.4} scale={11} blur={2.8} far={3} />
      </Canvas>
    </div>
  );
}
