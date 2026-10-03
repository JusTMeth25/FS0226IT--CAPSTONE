import {
  Box3, DirectionalLight, HemisphereLight, OrthographicCamera, PMREMGenerator, SRGBColorSpace, Scene, Vector3,
  WebGLRenderTarget, WebGLRenderer
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Caschi dei DJ della Disco (parte "d" del codice aspetto): modelli 3D di Sketchfab (licenza CC
 * Attribution, crediti in public/models/djs/credits.json, scaricati da BE/scripts/sketchfab_djs.py).
 *
 * Gli avatar sono disegnati in 2D, di tre quarti (il viso guarda a destra) e di spalle: ogni
 * casco si rende una volta sola in queste due viste e si incolla al posto della testa. Finche' il
 * modello non e' pronto avatar.js disegna un casco semplice del colore giusto.
 */

export const DJ_HEADS = ['Nessuno', 'Casco robot argento', 'Testa Marshmallow', 'Testa Mau5', 'Casco robot oro'];

/** Colore del casco provvisorio e rotazione del modello perche' guardi verso chi lo indossa. */
export const DJ_HEAD_STYLES = [
  null,
  { color: '#d1d5db', visor: '#111827', yaw: -2 * Math.PI / 5 },
  { color: '#f8fafc', visor: '#111827', yaw: 0 },
  { color: '#ef4444', visor: '#111827', yaw: 0, tint: '#e11d48' },
  { color: '#e7c55a', visor: '#1f2937', yaw: -2 * Math.PI / 5 }
];

/** Lato dello sprite del casco in pixel dell'avatar. */
export const HEAD_SIZE = 34;
const RES = 3;

const sprites = new Map();
const listeners = new Set();
let renderer = null;
let environment = null;
let target = null;

function getRenderer() {
  if (renderer) return renderer;
  renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(HEAD_SIZE * RES, HEAD_SIZE * RES, false);
  renderer.setClearColor(0x000000, 0);
  target = new WebGLRenderTarget(HEAD_SIZE * RES, HEAD_SIZE * RES);
  target.texture.colorSpace = SRGBColorSpace;
  environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  return renderer;
}

/** Il modello centrato nell'origine e scalato perche' stia in un cubo di lato 1. */
function normalize(root) {
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  root.scale.multiplyScalar(1 / Math.max(size.x, size.y, size.z));
  root.updateMatrixWorld(true);
  const center = new Box3().setFromObject(root).getCenter(new Vector3());
  root.position.sub(center);
  root.updateMatrixWorld(true);
}

/** Legge i pixel del render target (dal basso) e li rimette dritti in un canvas. */
function grab(r) {
  const w = HEAD_SIZE * RES;
  const pixels = new Uint8Array(w * w * 4);
  r.readRenderTargetPixels(target, 0, 0, w, w, pixels);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = w;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, w);
  for (let y = 0; y < w; y += 1) {
    const from = (w - 1 - y) * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      const a = pixels[from + x + 3];
      const k = a > 0 && a < 255 ? 255 / a : 1;
      image.data[y * w * 4 + x] = Math.min(255, pixels[from + x] * k);
      image.data[y * w * 4 + x + 1] = Math.min(255, pixels[from + x + 1] * k);
      image.data[y * w * 4 + x + 2] = Math.min(255, pixels[from + x + 2] * k);
      image.data[y * w * 4 + x + 3] = a;
    }
  }
  ctx.putImageData(image, 0, 0);
  // Rimpicciolito ai pixel dell'avatar, cosi' si incolla senza sfocature.
  const small = document.createElement('canvas');
  small.width = HEAD_SIZE;
  small.height = HEAD_SIZE;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(canvas, 0, 0, HEAD_SIZE, HEAD_SIZE);
  return small;
}

function render(gltf, index) {
  const r = getRenderer();
  const scene = new Scene();
  scene.environment = environment;
  scene.add(new HemisphereLight(0xffffff, 0x3a3550, 1.3));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(-2, 3, 4);
  scene.add(sun);
  const model = gltf.scene;
  // Modelli senza colori (la testa Mau5 arriva grigia): si tingono del colore del casco vero.
  const tint = DJ_HEAD_STYLES[index]?.tint;
  if (tint) model.traverse((o) => { if (o.isMesh && o.material?.color) { o.material = o.material.clone(); o.material.color.set(tint); } });
  normalize(model);
  scene.add(model);
  const camera = new OrthographicCamera(-0.56, 0.56, 0.56, -0.56, 0.1, 20);
  camera.position.set(0, 0.35, 5);
  camera.lookAt(0, 0, 0);
  r.setRenderTarget(target);
  const yaw = DJ_HEAD_STYLES[index]?.yaw || 0;
  const views = {};
  // Di tre quarti (il viso degli avatar guarda a destra) e di spalle.
  for (const [name, turn] of [['front', Math.PI / 5], ['back', Math.PI + Math.PI / 5]]) {
    model.rotation.y = yaw + turn;
    model.updateMatrixWorld(true);
    r.clear();
    r.render(scene, camera);
    views[name] = grab(r);
  }
  r.setRenderTarget(null);
  return views;
}

/** Casco pronto (front/back) o null; la prima richiesta avvia il caricamento. */
export function djHeadSprite(index, back) {
  if (!DJ_HEAD_STYLES[index]) return null;
  const entry = sprites.get(index);
  if (entry?.views) return back ? entry.views.back : entry.views.front;
  if (!entry) {
    sprites.set(index, { loading: true });
    new GLTFLoader().load(`${import.meta.env.BASE_URL}models/djs/d${index}.glb`, (gltf) => {
      try {
        sprites.set(index, { views: render(gltf, index) });
        listeners.forEach((fn) => fn(index));
      } catch {
        sprites.set(index, { failed: true });
      }
    }, undefined, () => sprites.set(index, { failed: true }));
  }
  return null;
}

/** Avvisa quando un casco e' pronto (avatar.js svuota la cache degli sprite). */
export function onDjHeadReady(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
