import {
  BoxGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, DirectionalLight, ExtrudeGeometry, Group, HemisphereLight, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PMREMGenerator, RingGeometry, SRGBColorSpace, Scene,
  Shape, WebGLRenderTarget, WebGLRenderer
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Orologi della gioielleria in 3D, costruiti in codice (niente file da scaricare): cassa, ghiera,
 * quadrante, lancette, corona, vetro e bracciale o cinturino, con materiali metallici veri
 * illuminati da un ambiente. Ogni orologio si rende una volta sola in un'immagine che il negozio,
 * l'usato e l'asta mostrano al posto del disegno piatto (LuxuryArt.WatchFace).
 *
 * Gli indici sono quelli del codice aspetto ("w1".."w11", LuxuryCatalog.java).
 */

const GOLD = '#d9a93a';
const ROSE = '#e3a07f';
const STEEL = '#d7dbe0';
const PLATINUM = '#e6e7ea';

/** Com'e' fatto ogni modello: forma, metallo, ghiera, quadrante, cinturino. */
const MODELS = {
  1: { name: 'Submarino', case: 'round', metal: STEEL, bezel: { color: '#0f6b3a', marks: '#e5e7eb', ceramic: true }, dial: { color: '#0b0d10', marks: 'lume' }, strap: { kind: 'oyster', color: STEEL }, crownGuards: true, date: true },
  2: { name: "Daytona d'oro", case: 'round', metal: GOLD, bezel: { color: GOLD, marks: '#3a2a08', tachy: true }, dial: { color: '#efe0b4', marks: 'baton', sub: '#8a6a22' }, strap: { kind: 'oyster', color: GOLD }, pushers: true },
  3: { name: 'Nautilo', case: 'cushion', metal: STEEL, bezel: { color: STEEL, thin: true }, dial: { color: '#23407a', marks: 'baton', pattern: 'stripes' }, strap: { kind: 'integrated', color: STEEL }, date: true },
  4: { name: 'Calatrava', case: 'round', metal: ROSE, bezel: { color: ROSE, thin: true }, dial: { color: '#f7f2e8', marks: 'dauphine', ink: '#7a4b2a' }, strap: { kind: 'leather', color: '#5b3a29' }, slim: true },
  5: { name: 'Quercia Reale', case: 'octagon', metal: STEEL, bezel: { color: STEEL, screws: true }, dial: { color: '#26407f', marks: 'baton', pattern: 'grid' }, strap: { kind: 'integrated', color: STEEL }, date: true },
  6: { name: 'Offshore Nero', case: 'octagon', metal: '#2a2a2e', ceramic: true, bezel: { color: '#1c1c1f', screws: true, ceramic: true }, dial: { color: '#0c0c0e', marks: 'baton', pattern: 'grid', sub: '#2d2d33' }, strap: { kind: 'rubber', color: '#141416' }, pushers: true },
  7: { name: 'GMT Pepsi', case: 'round', metal: STEEL, bezel: { color: '#c81e1e', color2: '#1d3f9e', marks: '#f1f5f9' }, dial: { color: '#0b0d10', marks: 'lume', gmt: true }, strap: { kind: 'jubilee', color: STEEL }, crownGuards: true, date: true },
  8: { name: 'Day-Date Platino', case: 'round', metal: PLATINUM, bezel: { color: PLATINUM, fluted: true }, dial: { color: '#a9d7f5', marks: 'baton', ink: '#1f3b57' }, strap: { kind: 'president', color: PLATINUM }, date: true, day: true },
  9: { name: 'Aquanaut Verde', case: 'cushion', metal: STEEL, bezel: { color: STEEL, thin: true }, dial: { color: '#245a35', marks: 'arabic', pattern: 'checker' }, strap: { kind: 'rubber', color: '#1f4d2c', pattern: true }, date: true },
  10: { name: 'Codice 11.59', case: 'round', metal: ROSE, bezel: { color: ROSE, thin: true }, dial: { color: '#14214d', marks: 'baton', pattern: 'sunburst' }, strap: { kind: 'leather', color: '#1c1c1f' } },
  11: { name: 'RM Scheletrato', case: 'tonneau', metal: '#b9bcc2', bezel: { color: '#9a9ea6', screws: true }, dial: { skeleton: true, color: '#1d1f24', marks: 'baton' }, strap: { kind: 'rubber', color: '#c81e2b' } }
};

export const WATCH_MODELS = new Set(Object.keys(MODELS).map(Number));

const W = 240;
const H = 200;
const RES = 2;

let renderer = null;
let target = null;
let environment = null;
const cache = new Map();

function getRenderer() {
  if (renderer) return renderer;
  renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W * RES, H * RES, false);
  renderer.setClearColor(0x000000, 0);
  target = new WebGLRenderTarget(W * RES, H * RES, { samples: 4 });
  target.texture.colorSpace = SRGBColorSpace;
  // Riflessi del metallo: senza un ambiente acciaio e oro verrebbero grigi e spenti.
  environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  return renderer;
}

// ------------------------------------------------------------------ materiali

const metal = (color, roughness = 0.22) => new MeshStandardMaterial({ color, metalness: 1, roughness });
const brushed = (color) => metal(color, 0.42);
const ceramic = (color) => new MeshPhysicalMaterial({ color, metalness: 0.1, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
const rubber = (color) => new MeshStandardMaterial({ color, metalness: 0, roughness: 0.75 });
const leather = (color) => new MeshStandardMaterial({ color, metalness: 0, roughness: 0.6 });

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// ------------------------------------------------------------------ quadrante

/** Quadrante disegnato su una texture: colore, motivo, indici stampati, contatori e datario. */
function dialTexture(spec) {
  const d = spec.dial;
  return canvasTexture(512, (ctx, s) => {
    const c = s / 2;
    const ink = d.ink || (isLight(d.color) ? '#1b1b1b' : '#f2f2f2');
    ctx.fillStyle = d.skeleton ? '#2a2c31' : d.color;
    ctx.fillRect(0, 0, s, s);
    if (d.pattern === 'stripes') {
      for (let y = 0; y < s; y += 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(0, y, s, 7);
      }
    } else if (d.pattern === 'grid' || d.pattern === 'checker') {
      const step = d.pattern === 'grid' ? 18 : 30;
      for (let y = 0; y < s; y += step) {
        for (let x = 0; x < s; x += step) {
          if (d.pattern === 'checker' && ((x + y) / step) % 2 === 0) continue;
          ctx.fillStyle = d.pattern === 'grid' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)';
          ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
        }
      }
    } else if (d.pattern === 'sunburst') {
      const g = ctx.createRadialGradient(c, c, 10, c, c, c);
      g.addColorStop(0, 'rgba(120,150,255,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    if (d.skeleton) {
      // Movimento a vista: ponti e ruote dentate dorate.
      ctx.strokeStyle = '#7d8088';
      ctx.lineWidth = 16;
      [[c, c * 0.45, c, c * 1.55], [c * 0.5, c * 0.7, c * 1.5, c * 1.3]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      [[c * 0.72, c * 0.72, 60], [c * 1.3, c * 0.82, 44], [c * 0.85, c * 1.3, 52], [c * 1.25, c * 1.28, 38]].forEach(([x, y, r]) => gear(ctx, x, y, r, '#d6a94a'));
    }
    // Contatori del cronografo.
    if (d.sub) {
      [[c * 0.62, c], [c * 1.38, c], [c, c * 1.4]].forEach(([x, y]) => {
        ctx.fillStyle = d.sub;
        ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth = 2;
        for (let i = 0; i < 12; i += 1) {
          const a = (i / 12) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 36, y + Math.sin(a) * 36); ctx.lineTo(x + Math.cos(a) * 44, y + Math.sin(a) * 44); ctx.stroke();
        }
      });
    }
    // Minuti sul bordo.
    ctx.strokeStyle = ink;
    for (let i = 0; i < 60; i += 1) {
      const a = (i / 60) * Math.PI * 2;
      ctx.lineWidth = i % 5 === 0 ? 0 : 2;
      if (i % 5 === 0) continue;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * 236, c + Math.sin(a) * 236); ctx.lineTo(c + Math.cos(a) * 248, c + Math.sin(a) * 248); ctx.stroke();
    }
    // Indici delle ore.
    for (let i = 0; i < 12; i += 1) {
      if ((spec.date && i === 3) || (spec.day && i === 0) || (d.sub && (i === 3 || i === 6 || i === 9))) continue;
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const x = c + Math.cos(a) * 196;
      const y = c + Math.sin(a) * 196;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      if (d.marks === 'lume') {
        ctx.fillStyle = '#f4f1e6';
        ctx.strokeStyle = '#9aa0a6';
        ctx.lineWidth = 3;
        if (i === 0) { ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(18, -22); ctx.lineTo(0, 16); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        else if (i % 3 === 0) { ctx.fillRect(-9, -24, 18, 48); ctx.strokeRect(-9, -24, 18, 48); }
        else { ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      } else if (d.marks === 'arabic') {
        ctx.rotate(-(a + Math.PI / 2));
        ctx.fillStyle = '#f4f1e6';
        ctx.font = 'bold 54px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i === 0 ? 12 : i), 0, 0);
      } else {
        ctx.fillStyle = d.marks === 'dauphine' ? '#c9a24e' : (isLight(d.color) ? '#8a6a22' : '#e9eaee');
        const w = i === 0 ? 14 : 9;
        ctx.fillRect(-w / 2, -30, w, 58);
        if (i === 0) ctx.fillRect(-w * 1.6, -30, w, 58);
      }
      ctx.restore();
    }
    // Datario a ore 3 e giorno a ore 12.
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (spec.date) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c + 150, c - 24, 60, 48);
      ctx.fillStyle = '#111111';
      ctx.fillText('15', c + 180, c + 2);
    }
    if (spec.day) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c - 80, c - 222, 160, 48);
      ctx.fillStyle = '#111111';
      ctx.fillText('GIOVEDÌ', c, c - 197);
    }
    // Firma sotto il 12.
    ctx.fillStyle = ink;
    ctx.font = 'bold 26px Georgia';
    if (!d.skeleton) ctx.fillText(spec.name.split(' ')[0].toUpperCase(), c, c - (spec.day ? 120 : 130));
  });
}

function gear(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const rr = i % 2 ? r : r * 0.86;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a2c31';
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b5121b';
  ctx.beginPath(); ctx.arc(x, y, r * 0.15, 0, Math.PI * 2); ctx.fill();
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 150;
}

/** Ghiera vista dall'alto: tacche, numeri della lunetta o tachimetro. */
function bezelTexture(b) {
  return canvasTexture(512, (ctx, s) => {
    const c = s / 2;
    if (b.color2) {
      ctx.fillStyle = b.color2;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = b.color;
      ctx.fillRect(0, 0, s, c);
    } else {
      ctx.fillStyle = b.color;
      ctx.fillRect(0, 0, s, s);
    }
    if (!b.marks) return;
    ctx.fillStyle = b.marks;
    ctx.strokeStyle = b.marks;
    for (let i = 0; i < 60; i += 1) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const r0 = i % 5 === 0 ? 205 : 222;
      ctx.lineWidth = i % 5 === 0 ? 7 : 3;
      if (!b.tachy && i > 15 && i % 5 !== 0) continue;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); ctx.lineTo(c + Math.cos(a) * 244, c + Math.sin(a) * 244); ctx.stroke();
    }
    // Triangolo a mezzogiorno.
    ctx.beginPath(); ctx.moveTo(c - 14, c - 248); ctx.lineTo(c + 14, c - 248); ctx.lineTo(c, c - 222); ctx.closePath(); ctx.fill();
  });
}

// ------------------------------------------------------------------ costruzione

/** Profilo della cassa nel piano XY, per le forme non rotonde. */
function caseShape(kind, r) {
  const shape = new Shape();
  if (kind === 'tonneau') {
    const w = r * 0.86;
    const h = r * 1.12;
    shape.moveTo(-w, -h * 0.6);
    shape.bezierCurveTo(-w * 1.12, 0, -w * 1.12, 0, -w, h * 0.6);
    shape.quadraticCurveTo(-w, h, -w * 0.6, h);
    shape.lineTo(w * 0.6, h);
    shape.quadraticCurveTo(w, h, w, h * 0.6);
    shape.bezierCurveTo(w * 1.12, 0, w * 1.12, 0, w, -h * 0.6);
    shape.quadraticCurveTo(w, -h, w * 0.6, -h);
    shape.lineTo(-w * 0.6, -h);
    shape.quadraticCurveTo(-w, -h, -w, -h * 0.6);
    return shape;
  }
  // Cuscino: quadrato con i lati bombati e gli angoli molto arrotondati (Nautilo, Aquanaut).
  const k = r * 0.95;
  const t = r * 0.42;
  shape.moveTo(-k + t, -k);
  shape.quadraticCurveTo(0, -k * 1.08, k - t, -k);
  shape.quadraticCurveTo(k, -k, k, -k + t);
  shape.quadraticCurveTo(k * 1.08, 0, k, k - t);
  shape.quadraticCurveTo(k, k, k - t, k);
  shape.quadraticCurveTo(0, k * 1.08, -k + t, k);
  shape.quadraticCurveTo(-k, k, -k, k - t);
  shape.quadraticCurveTo(-k * 1.08, 0, -k, -k + t);
  shape.quadraticCurveTo(-k, -k, -k + t, -k);
  return shape;
}

/** Il quadrante guarda verso +Z; il cinturino corre lungo Y. Raggio della cassa 1. */
function buildWatch(spec) {
  const group = new Group();
  const R = 1;
  const depth = spec.slim ? 0.22 : 0.36;
  const caseMat = spec.ceramic ? ceramic(spec.metal) : metal(spec.metal);
  const add = (geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const disc = (r, h, material, z, segments = 96) => {
    const mesh = add(new CylinderGeometry(r, r, h, segments), material, 0, 0, z);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };

  // Cassa.
  if (spec.case === 'round' || spec.case === 'octagon') {
    const mesh = disc(R, depth, caseMat, 0, spec.case === 'octagon' ? 8 : 96);
    if (spec.case === 'octagon') mesh.rotation.y = Math.PI / 8;
  } else {
    const geometry = new ExtrudeGeometry(caseShape(spec.case, R), { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4, curveSegments: 24 });
    add(geometry, caseMat, 0, 0, -depth / 2);
  }
  // Piano su cui poggiano ghiera e quadrante: le casse estruse hanno anche lo smusso sopra.
  const top = depth / 2 + (spec.case === 'round' || spec.case === 'octagon' ? 0 : 0.06);

  // Ghiera: anello sopra la cassa, piatto con la sua texture o scanalato.
  const b = spec.bezel;
  const outer = spec.case === 'tonneau' ? 0.84 : spec.case === 'cushion' ? 0.9 : 0.98;
  const inner = b.thin ? outer - 0.08 : outer - 0.2;
  const bezelMat = b.ceramic ? ceramic(b.color) : metal(b.color);
  if (spec.case === 'octagon') {
    const ring = add(new CylinderGeometry(outer, outer, 0.1, 8, 1, true), bezelMat, 0, 0, top + 0.05);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = Math.PI / 8;
    const cap = add(new RingGeometry(inner, outer, 8, 1), bezelMat, 0, 0, top + 0.1);
    cap.rotation.z = Math.PI / 8;
  } else if (b.fluted) {
    for (let i = 0; i < 48; i += 1) {
      const a = (i / 48) * Math.PI * 2;
      const rib = add(new BoxGeometry(0.05, outer - inner, 0.08), metal(b.color, 0.12), Math.cos(a) * (inner + outer) / 2, Math.sin(a) * (inner + outer) / 2, top + 0.04);
      rib.rotation.z = a - Math.PI / 2;
    }
  } else {
    // Solo il bordo esterno: dentro l'anello si vede il quadrante.
    const side = add(new CylinderGeometry(outer, outer, 0.1, 96, 1, true), bezelMat, 0, 0, top + 0.05);
    side.rotation.x = Math.PI / 2;
    const face = add(new RingGeometry(inner, outer, 96, 1), b.marks ? new MeshPhysicalMaterial({ map: bezelTexture(b), metalness: b.ceramic || b.color2 ? 0.15 : 1, roughness: 0.25, clearcoat: b.ceramic || b.color2 ? 1 : 0 }) : bezelMat, 0, 0, top + 0.101);
    face.renderOrder = 1;
  }
  // Otto viti esagonali (Quercia Reale, Offshore) o quattro sulla botte.
  if (b.screws) {
    const n = spec.case === 'tonneau' ? 4 : 8;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : Math.PI / 8);
      const rr = (inner + outer) / 2;
      const screw = add(new CylinderGeometry(0.045, 0.045, 0.03, 6), metal('#c7cbd1', 0.15), Math.cos(a) * rr, Math.sin(a) * rr * (n === 4 ? 1.25 : 1), top + 0.115);
      screw.rotation.x = Math.PI / 2;
    }
  }

  // Quadrante con la texture.
  const dialR = inner - 0.02;
  // Disco piatto rivolto verso +Z: la texture resta dritta, con il 12 in alto.
  disc(dialR, 0.04, metal(spec.metal, 0.3), top + 0.01);
  add(new CircleGeometry(dialR, 96), new MeshStandardMaterial({ map: dialTexture(spec), metalness: 0, roughness: 0.6, envMapIntensity: 0.25 }), 0, 0, top + 0.032);

  // Lancette alle 10:10, il secondo a ore 7 (rosso sullo scheletrato e sul GMT).
  const handColor = isLight(spec.dial.color || '#000') ? '#3a2a10' : '#f2f2f2';
  const handMat = metal(spec.metal === '#2a2a2e' ? '#e6e6e6' : handColor === '#f2f2f2' ? '#e9eaee' : '#8a6a22', 0.18);
  const hand = (len, width, angle, z, material = handMat) => {
    const mesh = add(new BoxGeometry(width, len, 0.015), material, 0, 0, z);
    mesh.geometry.translate(0, len / 2 - 0.06, 0);
    mesh.rotation.z = -angle;
    return mesh;
  };
  hand(dialR * 0.55, 0.07, (10 / 12) * Math.PI * 2 + (10 / 60) * (Math.PI / 6), top + 0.05);
  hand(dialR * 0.82, 0.05, (10 / 60) * Math.PI * 2, top + 0.065);
  hand(dialR * 0.9, 0.015, (35 / 60) * Math.PI * 2, top + 0.08, metal('#d42a2a', 0.3));
  if (spec.dial.gmt) hand(dialR * 0.8, 0.02, (4 / 12) * Math.PI * 2, top + 0.072, metal('#d42a2a', 0.3));
  disc(0.05, 0.03, handMat, top + 0.09, 24);

  // Vetro zaffiro: un disco quasi trasparente che prende i riflessi.
  disc(dialR + 0.01, 0.03, new MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0, transparent: true, opacity: 0.06, clearcoat: 1 }), top + 0.11);

  // Corona a ore 3, con le protezioni sui subacquei, e i pulsanti del cronografo.
  const crownX = spec.case === 'tonneau' ? 0.98 : spec.case === 'cushion' ? 1.06 : R + 0.06;
  const crown = add(new CylinderGeometry(0.11, 0.11, 0.14, 24), metal(spec.metal, 0.3), crownX, 0, 0);
  crown.rotation.z = Math.PI / 2;
  if (spec.crownGuards) {
    add(new BoxGeometry(0.12, 0.08, depth * 0.8), caseMat, R - 0.01, 0.15, 0);
    add(new BoxGeometry(0.12, 0.08, depth * 0.8), caseMat, R - 0.01, -0.15, 0);
  }
  if (spec.pushers) {
    [0.45, -0.45].forEach((y) => {
      const p = add(new CylinderGeometry(0.06, 0.06, 0.14, 16), metal(spec.metal, 0.3), crownX - 0.08, y, 0);
      p.rotation.z = Math.PI / 2 + (y > 0 ? -0.45 : 0.45);
    });
  }

  // Anse e cinturino o bracciale, che si piega allontanandosi dal polso.
  const strapW = spec.case === 'tonneau' ? 1.05 : 0.95;
  const reach = spec.case === 'tonneau' ? 1.12 : spec.case === 'cushion' ? 0.98 : 0.92;
  [1, -1].forEach((side) => {
    if (spec.case === 'round') {
      [-1, 1].forEach((sx) => add(new BoxGeometry(0.16, 0.42, depth * 0.7), caseMat, sx * strapW * 0.5, side * (R - 0.02), -0.02));
    }
    buildStrap(group, spec, side, reach, strapW, depth);
  });
  return group;
}

function buildStrap(group, spec, side, reach, width, depth) {
  const s = spec.strap;
  const segments = 9;
  let y = side * reach;
  let z = -depth * 0.15;
  let angle = 0;
  for (let i = 0; i < segments; i += 1) {
    const len = s.kind === 'leather' || s.kind === 'rubber' ? 0.34 : 0.26;
    const thick = s.kind === 'leather' ? 0.07 : s.kind === 'rubber' ? 0.1 : 0.13;
    const taper = width * (1 - i * 0.025);
    const piece = new Group();
    const part = (w, material, x = 0) => {
      const mesh = new Mesh(new BoxGeometry(w, len * 0.96, thick), material);
      mesh.position.x = x;
      piece.add(mesh);
    };
    if (s.kind === 'leather') part(taper, leather(s.color));
    else if (s.kind === 'rubber') {
      part(taper, rubber(s.color));
      if (s.pattern) part(taper * 0.6, rubber('#2b6b3d'), 0);
    } else if (s.kind === 'jubilee' || s.kind === 'president') {
      // Cinque maglie (jubilee) o tre arrotondate (president): lucide al centro.
      const n = s.kind === 'jubilee' ? 5 : 3;
      for (let k = 0; k < n; k += 1) {
        const w = taper / n;
        part(w * 0.94, k % 2 ? metal(s.color, 0.1) : brushed(s.color), -taper / 2 + w * (k + 0.5));
      }
    } else {
      // Oyster e integrato: maglia centrale e laterali spazzolate.
      part(taper * 0.34, s.kind === 'integrated' ? brushed(s.color) : metal(s.color, 0.12));
      part(taper * 0.31, brushed(s.color), -taper * 0.335);
      part(taper * 0.31, brushed(s.color), taper * 0.335);
    }
    piece.position.set(0, y + side * len / 2, z);
    // Il cinturino si piega verso il polso (lontano dalla camera, -Z) da entrambe le parti.
    piece.rotation.x = -side * angle;
    group.add(piece);
    y += side * Math.cos(angle) * len;
    z -= Math.sin(angle) * len;
    angle += 0.2;
  }
}

/** Fotografa l'orologio di tre quarti e restituisce un'immagine (data URL). */
function render(index) {
  const spec = MODELS[index];
  const r = getRenderer();
  const scene = new Scene();
  scene.environment = environment;
  // Il render va in una texture, dove three non applica il tone mapping: si abbassa l'ambiente
  // perche' acciaio e quadranti chiari non escano bianchi bruciati.
  scene.environmentIntensity = 0.75;
  scene.add(new HemisphereLight(0xffffff, 0x404050, 0.25));
  const key = new DirectionalLight(0xffffff, 0.75);
  key.position.set(3, 4, 6);
  scene.add(key);
  const watch = buildWatch(spec);
  // Di tre quarti: inclinato in avanti e girato verso la corona.
  watch.rotation.set(-0.62, 0.42, -0.18);
  scene.add(watch);

  const camera = new PerspectiveCamera(26, W / H, 0.1, 50);
  camera.position.set(0, 0.2, 8.4);
  camera.lookAt(0, 0.05, 0);

  r.setRenderTarget(target);
  r.render(scene, camera);
  const w = W * RES;
  const h = H * RES;
  const pixels = new Uint8Array(w * h * 4);
  r.readRenderTargetPixels(target, 0, 0, w, h, pixels);
  r.setRenderTarget(null);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  // Le righe arrivano dal basso; i bordi antialias sono premoltiplicati: si riportano pieni.
  for (let yy = 0; yy < h; yy += 1) {
    const from = (h - 1 - yy) * w * 4;
    const to = yy * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      const a = pixels[from + x + 3];
      const k = a > 0 && a < 255 ? 255 / a : 1;
      image.data[to + x] = Math.min(255, pixels[from + x] * k);
      image.data[to + x + 1] = Math.min(255, pixels[from + x + 1] * k);
      image.data[to + x + 2] = Math.min(255, pixels[from + x + 2] * k);
      image.data[to + x + 3] = a;
    }
  }
  ctx.putImageData(image, 0, 0);
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      [].concat(obj.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    }
  });
  return canvas.toDataURL('image/png');
}

/** Immagine 3D dell'orologio (data URL), resa la prima volta e poi tenuta in memoria. */
export function watchImage(index) {
  if (!MODELS[index]) return Promise.resolve(null);
  if (!cache.has(index)) {
    cache.set(index, new Promise((resolve) => {
      // Un orologio per fotogramma: il negozio non si blocca mentre li prepara.
      requestAnimationFrame(() => {
        try {
          resolve(render(index));
        } catch {
          resolve(null);
        }
      });
    }));
  }
  return cache.get(index);
}
