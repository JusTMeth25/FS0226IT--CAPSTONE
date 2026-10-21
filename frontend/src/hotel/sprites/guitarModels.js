import {
  Box3, DirectionalLight, Group, HemisphereLight, OrthographicCamera, PMREMGenerator, Quaternion, SRGBColorSpace, Scene,
  Vector3, WebGLRenderTarget, WebGLRenderer
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Chitarre del Rock Store con i modelli 3D dei controller veri di Guitar Hero e Rock Band
 * (Sketchfab, licenza CC Attribution, crediti in public/models/guitars/credits.json, scaricati da
 * tools/sketchfab_guitars.py).
 *
 * Alcuni file contengono piu' varianti dello stesso controller: per ogni chitarra si tengono solo
 * le mesh scelte. Il modello si raddrizza da solo (manico in alto, faccia verso chi guarda) e si
 * rende una volta per vista: la foto grande del negozio e lo sprite piccolo a tracolla
 * dell'avatar. Le chitarre senza modello restano disegnate a mano (GuitarFace, avatar.js).
 */

/** Indice della chitarra (parte "g") -> file e mesh da tenere (indici in ordine di visita). */
const MODELS = {
  3: { file: 'g3', meshes: [1] },
  4: { file: 'g4', meshes: [2, 3], flip: true },
  5: { file: 'g5' },
  6: { file: 'g6' },
  10: { file: 'g9', meshes: [0], flip: true },
  11: { file: 'g3', meshes: [0] }
};

/** File del modello di una chitarra (le chiavi di credits.json), o null. */
export function guitarModelFile(index) {
  return MODELS[index]?.file || null;
}

export function hasGuitarModel(index) {
  return Boolean(MODELS[index]);
}

/** Lunghezza della chitarra a tracolla, in pixel dell'avatar, e lato dello sprite. */
const AVATAR_LENGTH = 36;
const AVATAR_SIZE = 48;
const RES = 3;

const files = new Map();
const models = new Map();
const pictures = new Map();
const listeners = new Set();
let renderer = null;
let environment = null;

function getRenderer() {
  if (renderer) return renderer;
  renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  return renderer;
}

function loadFile(file) {
  if (!files.has(file)) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    files.set(file, loader.loadAsync(`${import.meta.env.BASE_URL}models/guitars/${file}.glb`));
  }
  return files.get(file);
}

/** Qualche centinaio di vertici delle mesh, nelle coordinate di `space`. */
function samplePoints(meshes, space) {
  const points = [];
  space.updateMatrixWorld(true);
  for (const mesh of meshes) {
    const position = mesh.geometry.attributes.position;
    const step = Math.max(1, Math.floor(position.count / 600));
    for (let i = 0; i < position.count; i += step) {
      points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    }
  }
  return points;
}

function extent(points, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    min = Math.min(min, p[axis]);
    max = Math.max(max, p[axis]);
  }
  return { min, max, size: max - min };
}

/**
 * Le mesh scelte dentro un gruppo, raddrizzate: manico lungo +Y, corpo in basso, faccia larga
 * verso +Z, altezza 1, centro del corpo nell'origine.
 */
function build(gltf, spec) {
  gltf.scene.updateMatrixWorld(true);
  const all = [];
  gltf.scene.traverse((o) => { if (o.isMesh) all.push(o); });
  const chosen = spec.meshes ? spec.meshes.map((i) => all[i]).filter(Boolean) : all;
  const inner = new Group();
  for (const mesh of chosen) {
    const copy = mesh.clone();
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(mesh.matrixWorld);
    inner.add(copy);
  }
  const meshes = inner.children;
  const align = new Group();
  align.add(inner);

  // Il lato piu' lungo e' il manico: si porta su Y.
  let points = samplePoints(meshes, align);
  const sizes = ['x', 'y', 'z'].map((axis) => extent(points, axis).size);
  const longest = sizes.indexOf(Math.max(...sizes));
  const from = new Vector3().setComponent(longest, 1);
  align.quaternion.premultiply(new Quaternion().setFromUnitVectors(from, new Vector3(0, 1, 0)));

  // Girata attorno al manico finche' la chitarra e' piu' sottile possibile vista di fronte.
  let best = { yaw: 0, depth: Infinity };
  for (let deg = 0; deg < 180; deg += 3) {
    const yaw = (deg * Math.PI) / 180;
    const test = align.quaternion.clone().premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw));
    const q = align.quaternion.clone();
    align.quaternion.copy(test);
    const depth = extent(samplePoints(meshes, align), 'z').size;
    align.quaternion.copy(q);
    if (depth < best.depth) best = { yaw, depth };
  }
  align.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), best.yaw));

  // Il corpo (la meta' piu' larga) va in basso.
  points = samplePoints(meshes, align);
  const y = extent(points, 'y');
  const mid = (y.min + y.max) / 2;
  const width = (half) => extent(points.filter((p) => (half ? p.y > mid : p.y <= mid)), 'x').size;
  if (width(true) > width(false)) align.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI));
  if (spec.flip) align.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI));

  // Altezza 1 e centro del corpo (le parti nel quarto piu' basso) nell'origine.
  points = samplePoints(meshes, align);
  const height = extent(points, 'y');
  align.scale.setScalar(1 / height.size);
  points = samplePoints(meshes, align);
  const low = extent(points, 'y');
  const body = points.filter((p) => p.y < low.min + (low.max - low.min) * 0.25);
  const center = body.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(body.length || 1);
  align.position.sub(center);
  const root = new Group();
  root.add(align);
  return root;
}

/** Rende il modello in un canvas: inclinato di `angle` (radianti, orario), girato di `yaw`. */
function render(model, { width, height, angle, yaw, length, fit }) {
  const r = getRenderer();
  const scene = new Scene();
  scene.environment = environment;
  scene.add(new HemisphereLight(0xffffff, 0x3a3550, 1.2));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(-2, 3, 4);
  scene.add(sun);
  const pivot = new Group();
  const spin = new Group();
  spin.add(model);
  pivot.add(spin);
  scene.add(pivot);
  spin.rotation.y = yaw;
  pivot.rotation.z = -angle;
  let camera;
  if (fit) {
    // Foto del negozio: la chitarra intera centrata nella foto.
    pivot.updateMatrixWorld(true);
    const box = new Box3().setFromObject(pivot);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = 0.92 * Math.min(width / size.x, height / size.y);
    const halfW = width / scale / 2;
    const halfH = height / scale / 2;
    camera = new OrthographicCamera(center.x - halfW, center.x + halfW, center.y + halfH, center.y - halfH, -10, 10);
  } else {
    // Sprite dell'avatar: centro del corpo al centro dello sprite, lunga `length` pixel.
    const half = width / length / 2;
    camera = new OrthographicCamera(-half, half, half, -half, -10, 10);
  }
  camera.position.set(0, 0, 5);
  const w = width * RES;
  const h = height * RES;
  r.setSize(w, h, false);
  const target = new WebGLRenderTarget(w, h, { samples: 4 });
  target.texture.colorSpace = SRGBColorSpace;
  r.setRenderTarget(target);
  r.clear();
  r.render(scene, camera);
  const pixels = new Uint8Array(w * h * 4);
  r.readRenderTargetPixels(target, 0, 0, w, h, pixels);
  r.setRenderTarget(null);
  target.dispose();
  spin.remove(model);

  // I pixel arrivano dal basso e con l'alfa premoltiplicato: si raddrizzano.
  const big = document.createElement('canvas');
  big.width = w;
  big.height = h;
  const bctx = big.getContext('2d');
  const image = bctx.createImageData(w, h);
  for (let row = 0; row < h; row += 1) {
    const from = (h - 1 - row) * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      const a = pixels[from + x + 3];
      const k = a > 0 && a < 255 ? 255 / a : 1;
      const to = row * w * 4 + x;
      image.data[to] = Math.min(255, pixels[from + x] * k);
      image.data[to + 1] = Math.min(255, pixels[from + x + 1] * k);
      image.data[to + 2] = Math.min(255, pixels[from + x + 2] * k);
      image.data[to + 3] = a;
    }
  }
  bctx.putImageData(image, 0, 0);
  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(big, 0, 0, width, height);
  return small;
}

function ensure(index) {
  const spec = MODELS[index];
  if (!spec || models.has(index)) return models.get(index)?.model || null;
  models.set(index, { loading: true });
  loadFile(spec.file)
    .then((gltf) => {
      models.set(index, { model: build(gltf, spec) });
      pictures.clear();
      listeners.forEach((fn) => fn(index));
    })
    .catch(() => models.set(index, { failed: true }));
  return null;
}

function picture(index, key, options) {
  const id = `${index}:${key}`;
  if (pictures.has(id)) return pictures.get(id);
  const model = ensure(index);
  if (!model) return null;
  let canvas;
  try {
    canvas = render(model, options);
  } catch {
    canvas = null;
  }
  pictures.set(id, canvas);
  return canvas;
}

/**
 * Sprite della chitarra a tracolla: (dx, dy) e' la direzione del manico nel disegno
 * dell'avatar, `back` la vista di spalle. Il centro del corpo e' al centro dello sprite.
 */
export function guitarSprite(index, dx, dy, back) {
  if (!MODELS[index]) return null;
  const angle = Math.atan2(dx, -dy);
  return picture(index, `a${angle.toFixed(2)}${back ? 'b' : 'f'}`, {
    width: AVATAR_SIZE, height: AVATAR_SIZE, angle, yaw: back ? Math.PI + 0.3 : 0.3, length: AVATAR_LENGTH
  });
}

export const GUITAR_SPRITE_SIZE = AVATAR_SIZE;

/** Foto della chitarra per il Rock Store (data URL), inclinata come quelle disegnate. */
export function guitarPicture(index) {
  if (!MODELS[index]) return null;
  const canvas = picture(index, 'shop', { width: 150, height: 180, angle: (35 * Math.PI) / 180, yaw: 0.45, fit: true });
  if (!canvas) return null;
  if (!canvas.dataUrl) canvas.dataUrl = canvas.toDataURL('image/png');
  return canvas.dataUrl;
}

/** Avvisa quando il modello di una chitarra e' pronto. */
export function onGuitarModelReady(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
