import {
  Box3, DirectionalLight, HemisphereLight, OrthographicCamera, PMREMGenerator, SRGBColorSpace, Scene, Vector3,
  WebGLRenderTarget, WebGLRenderer
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HALF_W } from '../iso.js';

/**
 * Auto sportive del quartiere con i modelli 3D di Sketchfab (frontend/public/models/cars, scaricati
 * da tools/sketchfab_cars.py, licenza CC Attribution: i crediti sono in credits.json).
 *
 * La stanza e' disegnata in 2D: ogni modello si rende una volta sola, con una camera ortografica
 * alla stessa angolazione dell'hotel (dimetrica 2:1), in 16 direzioni. Per ogni direzione due
 * immagini: l'auto intera (sotto l'avatar) e la stessa immagine tagliata sotto la linea della
 * cintura (sopra l'avatar), cosi' chi guida sembra seduto dentro. Finche' il modello non e' pronto il motore usa
 * l'auto disegnata a mano di vehicles.js.
 */

/** Veicoli (indice "r" del codice aspetto) che hanno un modello 3D. */
export const CAR_MODELS = new Set([5, 6, 7, 8, 9]);
/** Modelli con il muso dalla parte opposta rispetto a come arrivano da Sketchfab. */
const FLIP = new Set([7]);

const DIRS = 16;
/** Misure dell'immagine in pixel del mondo, e dove cade il centro dell'auto (a terra). */
export const CAR_W = 200;
export const CAR_H = 150;
export const CAR_FOOT = { x: CAR_W / 2, y: CAR_H * 0.62 };
const RES = 2;
/** Lunghezza dell'auto in caselle. */
const LENGTH = 1.9;
/** Pixel dello schermo per unita' della camera: una casella lungo x vale 32 px di lato (HALF_W). */
const PX = HALF_W * Math.SQRT2;
/** Fino a che altezza (frazione dell'auto) la carrozzeria copre chi e' seduto dentro. */
const BELT = 0.48;

const cache = new Map();
let renderer = null;
let environment = null;
let target = null;

function modelUrl(ride) {
  return `${import.meta.env.BASE_URL}models/cars/r${ride}.glb`;
}

function getRenderer() {
  if (renderer) return renderer;
  renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(CAR_W * RES, CAR_H * RES, false);
  renderer.setClearColor(0x000000, 0);
  // Si disegna in una texture e si leggono i pixel: copiare il canvas WebGL con drawImage su
  // alcune schede video restituisce l'immagine capovolta (le auto sembravano viste da sotto).
  target = new WebGLRenderTarget(CAR_W * RES, CAR_H * RES);
  target.texture.colorSpace = SRGBColorSpace;
  // Riflessi della carrozzeria: senza un ambiente le vernici metallizzate verrebbero nere.
  environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  return renderer;
}

/** Modello a terra, centrato, lungo LENGTH caselle nella direzione +X della scena. */
function normalize(root, flip) {
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  // Il lato lungo in pianta e' la lunghezza dell'auto: se sta lungo Z si gira di 90 gradi.
  if (size.z > size.x) root.rotation.y = Math.PI / 2;
  if (flip) root.rotation.y += Math.PI;
  root.updateMatrixWorld(true);
  const turned = new Box3().setFromObject(root);
  const s = turned.getSize(new Vector3());
  const k = LENGTH / Math.max(s.x, s.z);
  root.scale.multiplyScalar(k);
  root.updateMatrixWorld(true);
  const fitted = new Box3().setFromObject(root);
  const center = fitted.getCenter(new Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= fitted.min.y;
  root.updateMatrixWorld(true);
  return fitted.getSize(new Vector3()).y;
}

function renderFrames(gltf, ride) {
  const r = getRenderer();
  const scene = new Scene();
  scene.environment = environment;
  scene.add(new HemisphereLight(0xffffff, 0x3a3550, 1.2));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-4, 8, 3);
  scene.add(sun);
  const holder = new Scene();
  const model = gltf.scene;
  const height = normalize(model, FLIP.has(ride));
  holder.add(model);
  scene.add(holder);

  // Camera dimetrica come l'hotel: da +X +Z, alzata di 30 gradi; l'origine cade su CAR_FOOT.
  const camera = new OrthographicCamera(-CAR_FOOT.x / PX, (CAR_W - CAR_FOOT.x) / PX, CAR_FOOT.y / PX, -(CAR_H - CAR_FOOT.y) / PX, 0.1, 100);
  const d = 20;
  camera.position.set(d, d * Math.SQRT2 * Math.tan(Math.PI / 6), d);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  const frames = [];
  // Linea della cintura sullo schermo: sotto, l'auto copre le gambe di chi guida.
  const beltY = Math.round((CAR_FOOT.y - height * PX * Math.cos(Math.PI / 6) * BELT) * RES);
  const w = CAR_W * RES;
  const h = CAR_H * RES;
  const pixels = new Uint8Array(w * h * 4);
  // Fotogramma dalla texture: le righe arrivano dal basso, si rimettono dritte; i colori ai bordi
  // (antialiasing su sfondo trasparente) sono premoltiplicati e si riportano pieni.
  const grab = () => {
    r.readRenderTargetPixels(target, 0, 0, w, h, pixels);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(w, h);
    const out = image.data;
    for (let y = 0; y < h; y += 1) {
      const from = (h - 1 - y) * w * 4;
      const to = y * w * 4;
      for (let x = 0; x < w * 4; x += 4) {
        const a = pixels[from + x + 3];
        const k = a > 0 && a < 255 ? 255 / a : 1;
        out[to + x] = Math.min(255, pixels[from + x] * k);
        out[to + x + 1] = Math.min(255, pixels[from + x + 1] * k);
        out[to + x + 2] = Math.min(255, pixels[from + x + 2] * k);
        out[to + x + 3] = a;
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  };
  r.setRenderTarget(target);
  for (let i = 0; i < DIRS; i += 1) {
    // Direzione degli avatar (0 nord, 2 est...) in radianti nel piano delle caselle.
    const dir = (i * 8) / DIRS;
    const a = (dir - 2) * (Math.PI / 4);
    holder.rotation.y = -a;
    r.render(scene, camera);
    const full = grab();
    const lower = document.createElement('canvas');
    lower.width = w;
    lower.height = h;
    lower.getContext('2d').drawImage(full, 0, beltY, w, h - beltY, 0, beltY, w, h - beltY);
    frames.push({ full, lower });
  }
  r.setRenderTarget(null);
  // Il fattore per passare dall'altezza del modello ai pixel dell'hotel (serve a chi guida).
  return { frames, heightPx: height * PX * Math.cos(Math.PI / 6) };
}

/**
 * Immagini dell'auto per la direzione data (anche con i decimali), oppure null se il modello
 * non e' ancora pronto: al primo uso parte il caricamento.
 */
export function carFrames(ride, dir) {
  if (!CAR_MODELS.has(ride)) return null;
  let entry = cache.get(ride);
  if (!entry) {
    entry = { ready: null, promise: null };
    cache.set(ride, entry);
    entry.promise = new GLTFLoader().loadAsync(modelUrl(ride)).then((gltf) => {
      entry.ready = renderFrames(gltf, ride);
      return entry.ready;
    }).catch(() => {
      entry.failed = true;
      return null;
    });
  }
  if (!entry.ready) return null;
  const index = ((Math.round((dir * DIRS) / 8) % DIRS) + DIRS) % DIRS;
  return { ...entry.ready.frames[index], heightPx: entry.ready.heightPx };
}

/** Promessa che si risolve quando il modello e' pronto (per le anteprime del negozio). */
export function whenCarReady(ride) {
  carFrames(ride, 0);
  return cache.get(ride)?.promise || Promise.resolve(null);
}

/** Disegna uno strato dell'auto 3D; false se il modello non e' pronto. */
export function drawCarModel(ctx, ride, foot, dir, scale, layer) {
  const frames = carFrames(ride, dir);
  if (!frames) return false;
  const image = layer === 'over' ? frames.lower : frames.full;
  ctx.drawImage(image, foot.x - CAR_FOOT.x * scale, foot.y - CAR_FOOT.y * scale, CAR_W * scale, CAR_H * scale);
  return true;
}

