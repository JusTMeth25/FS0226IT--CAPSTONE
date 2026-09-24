import { useEffect, useState } from 'react';
import { CanvasTexture, SRGBColorSpace, TextureLoader } from 'three';

function finish(texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Artwork sostitutiva disegnata su canvas: stessa idea di placeholderImage() in cardUtils,
 * ma senza passare da un'immagine SVG, che WebGL non sempre accetta come texture.
 */
export function makePlaceholderTexture(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111B3D';
  ctx.fillRect(0, 0, 400, 560);
  const glow = ctx.createRadialGradient(200, 220, 10, 200, 220, 180);
  glow.addColorStop(0, `${color}88`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 400, 560);

  ctx.fillStyle = color;
  ctx.font = 'bold 150px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name || '?').charAt(0).toUpperCase(), 200, 230);

  return finish(new CanvasTexture(canvas));
}

/**
 * Dorso della carta: un vinile neon con i solchi, come il retro di un mazzo collezionabile.
 * Generato una volta sola e condiviso da tutte le carte.
 */
let backTexture = null;
export function getCardBackTexture() {
  if (backTexture) return backTexture;

  const w = 500;
  const h = 700;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0E1635');
  bg.addColorStop(0.5, '#050816');
  bg.addColorStop(1, '#1a0b3a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Griglia sottile come sfondo, ripresa dall'Aurora dell'app.
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  const cx = w / 2;
  const cy = h / 2 - 30;
  ctx.fillStyle = '#07070c';
  ctx.beginPath(); ctx.arc(cx, cy, 190, 0, Math.PI * 2); ctx.fill();

  for (let r = 70; r < 188; r += 3) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.04 + (r % 9 === 0 ? 0.06 : 0)})`;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#EC4899';
  ctx.shadowColor = '#EC4899';
  ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(cx, cy, 188, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#22D3EE';
  ctx.shadowColor = '#22D3EE';
  ctx.beginPath(); ctx.arc(cx, cy, 140, -0.6, 1.4); ctx.stroke();
  ctx.shadowBlur = 0;

  const label = ctx.createRadialGradient(cx, cy, 5, cx, cy, 64);
  label.addColorStop(0, '#EC4899');
  label.addColorStop(1, '#8B5CF6');
  ctx.fillStyle = label;
  ctx.beginPath(); ctx.arc(cx, cy, 64, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#050816';
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#F0F0F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 30px system-ui, sans-serif';
  ctx.fillText('VD', cx, cy - 30);

  ctx.font = '900 54px system-ui, sans-serif';
  ctx.shadowColor = '#8B5CF6';
  ctx.shadowBlur = 24;
  ctx.fillText('VINYLDEX', cx, h - 90);
  ctx.shadowBlur = 0;

  backTexture = finish(new CanvasTexture(canvas));
  return backTexture;
}

/** Solchi di un vinile d'oro visti dall'alto, per la faccia del disco leggendario. */
let vinylTexture = null;
export function getVinylTexture() {
  if (vinylTexture) return vinylTexture;

  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const c = s / 2;

  ctx.fillStyle = '#0b0906';
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();

  for (let r = 90; r < c - 4; r += 2) {
    const shine = 0.08 + 0.12 * Math.abs(Math.sin(r * 0.09));
    ctx.strokeStyle = `rgba(255, 200, 80, ${shine})`;
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  }

  // Riflesso a spicchi: e' lui a far vedere che il disco gira.
  const sheen = ctx.createConicGradient(0, c, c);
  sheen.addColorStop(0, 'rgba(255, 230, 150, 0.45)');
  sheen.addColorStop(0.12, 'rgba(255, 230, 150, 0)');
  sheen.addColorStop(0.5, 'rgba(255, 230, 150, 0.45)');
  sheen.addColorStop(0.62, 'rgba(255, 230, 150, 0)');
  sheen.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = sheen;
  ctx.beginPath(); ctx.arc(c, c, c - 2, 0, Math.PI * 2); ctx.fill();

  const label = ctx.createRadialGradient(c, c, 4, c, c, 88);
  label.addColorStop(0, '#FFF3B0');
  label.addColorStop(1, '#FFB300');
  ctx.fillStyle = label;
  ctx.beginPath(); ctx.arc(c, c, 86, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2600';
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEGEND', c, c - 32);
  ctx.beginPath(); ctx.arc(c, c, 8, 0, Math.PI * 2); ctx.fill();

  vinylTexture = finish(new CanvasTexture(canvas));
  return vinylTexture;
}

/**
 * Rende trasparente lo sfondo scuro intorno a un'immagine, per esempio il nero attorno alla busta
 * del pacchetto: senza, in 3D si vedrebbe un rettangolo nero dietro alla figura.
 *
 * Riempimento a macchia d'olio partendo dai bordi: diventano trasparenti solo i pixel scuri
 * collegati al bordo, non i neri che fanno parte del disegno all'interno della figura.
 */
function keyOutBackground(image, threshold = 40, maxSize = 1024) {
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const w = Math.round(image.width * scale);
  const h = Math.round(image.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);

  const pixels = ctx.getImageData(0, 0, w, h);
  const data = pixels.data;
  const isDark = (i) => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) < threshold;
  const visited = new Uint8Array(w * h);
  const stack = [];

  for (let x = 0; x < w; x += 1) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y += 1) { stack.push(y * w, y * w + w - 1); }

  while (stack.length) {
    const i = stack.pop();
    if (visited[i] || !isDark(i)) continue;
    visited[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }

  // Bordo morbido: i pixel opachi accanto allo sfondo tolto diventano semitrasparenti,
  // altrimenti il contorno della busta resterebbe seghettato.
  for (let i = 0; i < w * h; i += 1) {
    if (visited[i]) continue;
    const x = i % w;
    const near = (x > 0 && visited[i - 1]) || (x < w - 1 && visited[i + 1])
      || (i >= w && visited[i - w]) || (i < w * (h - 1) && visited[i + w]);
    if (near) data[i * 4 + 3] = 128;
  }

  ctx.putImageData(pixels, 0, 0);
  return finish(new CanvasTexture(canvas));
}

/**
 * Carica un'immagine come texture WebGL.
 *
 * Le carte importate arrivano da server esterni che non sempre mandano gli header CORS:
 * senza, WebGL rifiuta l'immagine. In quel caso si usa l'artwork sostitutiva invece di
 * lasciare la scena vuota o farla crashare.
 *
 * Con `transparentBackground` lo sfondo scuro attorno alla figura diventa trasparente.
 */
export function useSafeTexture(url, fallbackName, fallbackColor, { transparentBackground = false } = {}) {
  // La texture e' salvata insieme all'URL da cui arriva: cambiando carta non si vede per un
  // istante quella precedente, e senza URL il risultato e' semplicemente null.
  const [loaded, setLoaded] = useState({ url: null, texture: null });

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    let texture = null;

    const publish = (tex) => {
      texture = tex;
      setLoaded({ url, texture: tex });
    };
    const applyFallback = () => {
      if (!cancelled) publish(makePlaceholderTexture(fallbackName, fallbackColor));
    };

    if (url.startsWith('data:image/svg')) {
      // Il segnaposto SVG di cardUtils non serve a WebGL: si disegna direttamente su canvas.
      queueMicrotask(applyFallback);
    } else {
      const loader = new TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        url,
        (tex) => {
          if (cancelled) { tex.dispose(); return; }
          if (transparentBackground) {
            publish(keyOutBackground(tex.image));
            tex.dispose();
          } else {
            publish(finish(tex));
          }
        },
        undefined,
        applyFallback
      );
    }

    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [url, fallbackName, fallbackColor, transparentBackground]);

  return url && loaded.url === url ? loaded.texture : null;
}
