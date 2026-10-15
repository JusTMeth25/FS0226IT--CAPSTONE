import { useEffect, useRef, useState } from 'react';
import { WATCH_STYLES } from '../sprites/avatar.js';
import { drawVehiclePreview, whenVehicleReady } from '../sprites/vehicles.js';
import AvatarPreview from './AvatarPreview.jsx';
import GuitarFace from './GuitarFace.jsx';

/**
 * Disegni dei pezzi dei negozi del quartiere, usati dal negozio, dall'usato e dall'asta: veicolo
 * (anche il modello 3D), orologio, gioiello, chitarra; i capi si vedono indossati sull'avatar.
 */
/** Veicolo in anteprima, girato di tre quarti: con il modello 3D appena e' pronto. */
export function VehiclePreview({ ride }) {
  const ref = useRef(null);
  useEffect(() => {
    let alive = true;
    const draw = () => { if (alive && ref.current) drawVehiclePreview(ref.current, ride); };
    draw();
    whenVehicleReady(ride).then(draw);
    return () => { alive = false; };
  }, [ride]);
  return <canvas ref={ref} className="lux-vehicle" width={180} height={120} aria-hidden="true" />;
}

/**
 * Orologio in 3D (watchModels.js, reso una volta in un'immagine). Finche' il modello non e' pronto
 * si vede il disegno piatto, che resta anche dove il WebGL non c'e'.
 */
export function WatchFace({ index }) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    let alive = true;
    import('../sprites/watchModels.js')
      .then((m) => m.watchImage(index))
      .then((src) => { if (alive && src) setImage(src); })
      .catch(() => {});
    return () => { alive = false; };
  }, [index]);
  if (image) return <img className="lux-watch lux-watch-3d" src={image} alt="" aria-hidden="true" />;
  return <WatchSketch index={index} />;
}

/** Quadrante dell'orologio ingrandito: rotondo, ottagonale ("Quercia Reale") o a botte (scheletrato). */
function WatchSketch({ index }) {
  const w = WATCH_STYLES[index];
  if (!w) return null;
  const octagon = index === 5 || index === 6;
  let shape = <circle cx="40" cy="32" r="22" fill={w.steel} stroke={w.bezel} strokeWidth="5" />;
  if (octagon) shape = <polygon points="30,8 50,8 64,22 64,42 50,56 30,56 16,42 16,22" fill={w.steel} stroke={w.bezel} strokeWidth="5" />;
  if (w.skeleton) shape = <rect x="20" y="6" width="40" height="52" rx="14" fill={w.steel} stroke={w.bezel} strokeWidth="4" />;
  if (w.bezel2) {
    shape = (
      <>
        <path d="M18 32 A22 22 0 0 1 62 32 Z" fill={w.bezel} />
        <path d="M18 32 A22 22 0 0 0 62 32 Z" fill={w.bezel2} />
      </>
    );
  }
  return (
    <svg className="lux-watch" viewBox="0 0 80 64" aria-hidden="true">
      <rect x="31" y="0" width="18" height="64" rx="4" fill={w.strap} />
      {shape}
      <circle cx="40" cy="32" r="14" fill={w.dial} />
      {w.skeleton && [0, 1, 2].map((i) => <circle key={i} cx={34 + i * 6} cy={28 + (i % 2) * 8} r="3" fill="none" stroke="#d4a017" strokeWidth="1.5" />)}
      {index === 3 && [26, 30, 34, 38].map((y) => <line key={y} x1="30" x2="50" y1={y} y2={y} stroke="#3b5bb5" strokeWidth="1" />)}
      {octagon && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <circle key={i} cx={40 + Math.cos((i * Math.PI) / 4) * 18} cy={32 + Math.sin((i * Math.PI) / 4) * 18} r="1.4" fill="#f5f5f5" />
      ))}
      <line x1="40" y1="32" x2="40" y2="22" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="32" x2="47" y2="35" stroke="#f8fafc" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Gioiello ingrandito: collana sul busto o coppia di orecchini. */
export function JewelFace({ part, index }) {
  const n = { 1: ['#f8fafc', 'beads'], 2: ['#e0a82e', 'chain'], 3: ['#dbeafe', 'beads'], 4: ['#16a34a', 'pendant'], 5: ['#dc2626', 'beads'], 6: ['#e0a82e', 'medal'] };
  const e = { 1: ['#e0f2fe', 'dot'], 2: ['#e0a82e', 'hoop'], 3: ['#f8fafc', 'drop'], 4: ['#16a34a', 'drop'], 5: ['#dc2626', 'dot'], 6: ['#1d4ed8', 'dot'] };
  if (part === 'n') {
    const [color, kind] = n[index] || [];
    const gold = index === 2 || index === 4 || index === 6;
    return (
      <svg className="lux-watch" viewBox="0 0 80 64" aria-hidden="true">
        <path d="M14 6 Q40 58 66 6" fill="none" stroke={gold ? '#e0a82e' : '#e5e7eb'} strokeWidth={kind === 'chain' ? 5 : 2} />
        {kind === 'beads' && Array.from({ length: 11 }, (_, i) => {
          const t = i / 10;
          const x = 14 + t * 52;
          const y = 6 + 4 * 26 * t * (1 - t) * 1.0;
          return <circle key={i} cx={x} cy={y} r="3.4" fill={color} stroke="rgba(0,0,0,.25)" />;
        })}
        {kind === 'pendant' && <ellipse cx="40" cy="38" rx="5" ry="8" fill={color} stroke="#e0a82e" strokeWidth="1.5" />}
        {kind === 'medal' && <circle cx="40" cy="38" r="8" fill={color} stroke="#a16207" strokeWidth="2" />}
      </svg>
    );
  }
  const [color, shape] = e[index] || [];
  const one = (x) => {
    if (shape === 'hoop') return <circle key={x} cx={x} cy="34" r="12" fill="none" stroke={color} strokeWidth="4" />;
    if (shape === 'drop') return <g key={x}><line x1={x} y1="14" x2={x} y2="26" stroke="#e0a82e" strokeWidth="2" /><ellipse cx={x} cy="36" rx="7" ry="10" fill={color} /></g>;
    return <circle key={x} cx={x} cy="30" r="8" fill={color} stroke="#e5e7eb" strokeWidth="2" />;
  };
  return <svg className="lux-watch" viewBox="0 0 80 64" aria-hidden="true">{[22, 58].map(one)}</svg>;
}


/** Il pezzo giusto per la chiave del catalogo: parte ("o", "w", "r", "n", "e", "g") e indice. */
export default function LuxuryArt({ part, index, look }) {
  if (part === 'r') return <VehiclePreview ride={index} />;
  if (part === 'w') return <WatchFace index={index} />;
  if (part === 'n' || part === 'e') return <JewelFace part={part} index={index} />;
  if (part === 'g') return <GuitarFace index={index} />;
  return look ? <AvatarPreview look={look} scale={1} /> : <i className="ph-fill ph-t-shirt lux-art-icon" />;
}
