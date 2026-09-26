import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, Lightformer, PresentationControls, RoundedBox, Sparkles } from '@react-three/drei';
import { CanvasTexture, DoubleSide, MathUtils, Quaternion, SRGBColorSpace } from 'three';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';
import { getTier } from './rarityTiers.js';
import { coverScale } from './holoMaterial.js';
import { getCardBackTexture, useSafeTexture } from './textures.js';
import { useDocumentVisible } from './useThreeEnabled.js';
import { BASE_URL } from '../../services/apiClient.js';
import { CARD_BACKS } from '../../utils/cardBacks.js';
import { gradeInfo, gradeTone, gradedValue } from '../../utils/gradeUtils.js';
import { getSourceLabel } from '../../utils/cardUtils.js';

const CARD_W = 2.5;
const CARD_H = 3.5;
const CARD_DEPTH = 0.04;
const CARD_RADIUS = 0.14;

/**
 * Indirizzo da cui caricare l'artwork come texture. Le immagini delle carte importate stanno su
 * server esterni che spesso non mandano gli header CORS, e WebGL le rifiuterebbe: passano dal
 * backend (GET /api/cards/{id}/image). Le immagini locali e i segnaposto restano come sono.
 */
function textureUrl(card) {
  const url = resolveCardImage(card);
  if (!/^https?:\/\//.test(url)) return url;
  return `${BASE_URL}/cards/${encodeURIComponent(card.id)}/image`;
}

/** Cofanetto: misure della custodia e dell'etichetta, attorno alla carta. */
const SLAB_W = CARD_W + 0.46;
const SLAB_LABEL_H = 0.95;
const SLAB_H = CARD_H + SLAB_LABEL_H + 0.5;
const SLAB_DEPTH = 0.26;
const TONES = { gold: ['#fff7d1', '#f3d36b', '#b8860b'], silver: ['#f8fafc', '#cbd5e1', '#64748b'], bronze: ['#fde8d7', '#e0a57a', '#92400e'] };

/** Etichetta del cofanetto disegnata su canvas: marca, nome, set, voto, certificato, valore. */
function slabLabelTexture(card) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  const info = gradeInfo(card.grade);
  const tone = gradeTone(card.grade);
  ctx.fillStyle = '#fdfdf8';
  ctx.fillRect(0, 0, 1024, 340);
  ctx.fillStyle = tone === 'gold' ? '#b91c1c' : tone === 'silver' ? '#334155' : '#7c2d12';
  ctx.fillRect(0, 0, 1024, 56);
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillStyle = '#fde047';
  ctx.fillText('VINYLDEX', 28, 40);
  ctx.fillStyle = '#fff';
  ctx.fillText('GRADING', 222, 40);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 50px Arial, sans-serif';
  let name = (card.name || '').toUpperCase();
  while (ctx.measureText(name).width > 700 && name.length > 4) name = `${name.slice(0, -2)}…`;
  ctx.fillText(name, 28, 128);
  ctx.font = '32px Arial, sans-serif';
  ctx.fillStyle = '#444';
  const set = [card.setName || getSourceLabel(card.source), card.number ? `#${card.number}` : null].filter(Boolean).join(' ');
  ctx.fillText(set.slice(0, 44), 28, 178);
  ctx.fillText(`${card.gradedAt ? new Date(card.gradedAt).getFullYear() : new Date().getFullYear()} · ${info.label}`, 28, 222);
  ctx.font = '26px "Courier New", monospace';
  ctx.fillText(`CERT ${card.gradeCert || 'VDX'}`, 28, 300);
  const value = gradedValue(card);
  if (value) ctx.fillText(`VALORE ${value}`, 420, 300);
  // Riquadro del voto.
  const [light, mid, edge] = TONES[tone];
  const grad = ctx.createLinearGradient(0, 80, 0, 260);
  grad.addColorStop(0, light);
  grad.addColorStop(1, mid);
  ctx.fillStyle = grad;
  ctx.fillRect(790, 76, 206, 190);
  ctx.lineWidth = 8;
  ctx.strokeStyle = edge;
  ctx.strokeRect(790, 76, 206, 190);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.font = 'bold 130px "Arial Black", Arial, sans-serif';
  ctx.fillText(String(card.grade), 893, 208);
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText(info.label, 893, 250);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Custodia trasparente con l'etichetta in alto: la carta gradata ci sta sigillata dentro. */
function SlabCase({ card }) {
  const label = useMemo(() => slabLabelTexture(card), [card]);
  const labelY = SLAB_H / 2 - SLAB_LABEL_H / 2 - 0.16;
  return (
    <group>
      <RoundedBox args={[SLAB_W, SLAB_H, SLAB_DEPTH]} radius={0.12} smoothness={4} position={[0, SLAB_LABEL_H / 2, 0]}>
        <meshPhysicalMaterial color="#e8f0ff" transparent opacity={0.16} roughness={0.04} metalness={0} clearcoat={1}
          clearcoatRoughness={0.03} reflectivity={0.9} side={DoubleSide} depthWrite={false} />
      </RoundedBox>
      {/* Etichetta davanti e retro bianco con la marca. */}
      <mesh position={[0, labelY + SLAB_LABEL_H / 2, SLAB_DEPTH / 2 - 0.05]}>
        <planeGeometry args={[SLAB_W - 0.24, SLAB_LABEL_H]} />
        <meshStandardMaterial map={label} roughness={0.5} />
      </mesh>
      <mesh position={[0, labelY + SLAB_LABEL_H / 2, -SLAB_DEPTH / 2 + 0.05]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[SLAB_W - 0.24, SLAB_LABEL_H]} />
        <meshStandardMaterial color="#f5f5f0" roughness={0.6} />
      </mesh>
      {/* Culla scura attorno alla carta. */}
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[CARD_W + 0.16, CARD_H + 0.16]} />
        <meshStandardMaterial color="#0f1222" roughness={0.8} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function CardModel({ card, flipped, onFlip }) {
  const color = getRarityColor(card.rarity);
  const tier = getTier(card.rarity);
  const front = useSafeTexture(textureUrl(card), card.name, color);
  const officialBack = useSafeTexture(CARD_BACKS[card.source] || null, card.name, color);
  const back = useMemo(() => officialBack || getCardBackTexture(), [officialBack]);
  // Il foil pieno sta bene sul dorso VinylDex; su quelli ufficiali resta appena accennato.
  const backHolo = officialBack ? 0.12 : 0.3;

  const flipRef = useRef(null);
  const frontMatRef = useRef(null);
  const backMatRef = useRef(null);
  const auraRef = useRef(null);
  const worldQuat = useRef(null);

  const frontScale = useMemo(() => coverScale(front, CARD_W, CARD_H), [front]);
  const backScale = useMemo(() => coverScale(back, CARD_W, CARD_H), [back]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const flip = flipRef.current;
    if (!flip) return;

    flip.rotation.y = MathUtils.damp(flip.rotation.y, flipped ? Math.PI : 0, 6, delta);

    // L'inclinazione del foil viene dalla rotazione reale della carta nel mondo, cosi'
    // l'arcobaleno scorre sia trascinando sia durante il giro.
    worldQuat.current ??= new Quaternion();
    const q = flip.getWorldQuaternion(worldQuat.current);
    const tiltX = 2 * (q.y * q.w + q.x * q.z);
    const tiltY = 2 * (q.x * q.w - q.y * q.z);

    [frontMatRef.current, backMatRef.current].forEach((mat) => {
      if (!mat) return;
      mat.uTime = state.clock.elapsedTime;
      mat.uTilt.set(tiltX, tiltY);
    });

    if (auraRef.current) auraRef.current.rotation.y += delta * 0.25;
  });

  return (
    <group>
      <group ref={auraRef}>
        <Sparkles
          count={Math.round(tier.aura / 3)}
          scale={[CARD_W * 1.8, CARD_H * 1.4, 2]}
          size={2}
          speed={0.2}
          color={color}
          opacity={0.45}
        />
      </group>

      <group ref={flipRef} onDoubleClick={onFlip}>
        {card.grade > 0 && <SlabCase card={card} />}
        {/* Bordo: una lastra smussata leggermente piu' grande, metallica e del colore della rarita'. */}
        <RoundedBox args={[CARD_W + 0.05, CARD_H + 0.05, CARD_DEPTH]} radius={CARD_RADIUS} smoothness={4}>
          <meshStandardMaterial color={color} metalness={0.9} roughness={0.25} emissive={color} emissiveIntensity={0.15} />
        </RoundedBox>

        {front && (
          <mesh position={[0, 0, CARD_DEPTH / 2 + 0.002]}>
            <planeGeometry args={[CARD_W, CARD_H]} />
            <holoMaterial
              ref={frontMatRef}
              uMap={front}
              uSize={[CARD_W, CARD_H]}
              uRadius={CARD_RADIUS}
              uUvScale={frontScale}
              uIntensity={tier.holo}
            />
          </mesh>
        )}

        <mesh position={[0, 0, -CARD_DEPTH / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <holoMaterial
            ref={backMatRef}
            uMap={back}
            uSize={[CARD_W, CARD_H]}
            uRadius={CARD_RADIUS}
            uUvScale={backScale}
            uIntensity={backHolo}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Carta da collezione in 3D per la pagina di dettaglio.
 *
 * Si trascina per girarla in ogni direzione e al rilascio torna in posizione con una molla.
 * Doppio tocco, o il pulsante sotto, la voltano sul dorso. Le luci sono generate in scena
 * (Lightformer) e non scaricate da un CDN: l'app deve funzionare anche offline in Capacitor.
 */
export default function Card3D({ card }) {
  const [flipped, setFlipped] = useState(false);
  const visible = useDocumentVisible();
  const toggle = () => setFlipped((f) => !f);

  return (
    <div className="card-3d-stage">
      <div className="card-3d-canvas">
        <Canvas
          flat
          dpr={[1, 2]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: [0, card.grade > 0 ? 0.4 : 0, card.grade > 0 ? 8.2 : 6.4], fov: 38 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 3, 5]} intensity={1.2} />

          {/* Luci neutre per i riflessi del bordo metallico: niente colori, niente anelli dietro. */}
          <Environment resolution={32}>
            <Lightformer form="rect" intensity={1.5} position={[0, 4, 3]} scale={[6, 2, 1]} color="#ffffff" />
            <Lightformer form="rect" intensity={0.8} position={[-4, 0, 2]} scale={[2, 6, 1]} color="#ffffff" />
          </Environment>

          <PresentationControls
            global={false}
            cursor
            snap
            speed={1.6}
            polar={[-Math.PI / 3, Math.PI / 3]}
            azimuth={[-Infinity, Infinity]}
          >
            <Float speed={1.4} rotationIntensity={0.08} floatIntensity={0.15}>
              <CardModel card={card} flipped={flipped} onFlip={toggle} />
            </Float>
          </PresentationControls>
        </Canvas>
      </div>

      <button type="button" className="btn btn-secondary card-3d-flip" onClick={toggle}>
        <i className="ph-fill ph-arrows-clockwise" /> {flipped ? 'Mostra il fronte' : card.grade > 0 ? 'Gira il cofanetto' : 'Gira la carta'}
      </button>
    </div>
  );
}
