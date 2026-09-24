import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, Lightformer, PresentationControls, RoundedBox, Sparkles } from '@react-three/drei';
import { MathUtils, Quaternion } from 'three';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';
import { getTier } from './rarityTiers.js';
import { coverScale } from './holoMaterial.js';
import { getCardBackTexture, useSafeTexture } from './textures.js';
import { useDocumentVisible } from './useThreeEnabled.js';
import { BASE_URL } from '../../services/apiClient.js';

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

/**
 * Dorsi ufficiali dei giochi da cui arrivano le carte importate, salvati in locale cosi'
 * funzionano anche offline. Le carte VinylDex usano il dorso VinylDex disegnato su canvas.
 */
const CARD_BACKS = {
  pokemon: '/assets/img/backs/pokemon.jpg',
  scryfall: '/assets/img/backs/scryfall.jpg',
  yugioh: '/assets/img/backs/yugioh.jpg',
  onepiece: '/assets/img/backs/onepiece.jpg',
  digimon: '/assets/img/backs/digimon.jpg',
  lorcana: '/assets/img/backs/lorcana.png',
  riftbound: '/assets/img/backs/riftbound.png',
  dragonball: '/assets/img/backs/dragonball.png',
  gundam: '/assets/img/backs/gundam.jpg'
};

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
          camera={{ position: [0, 0, 6.4], fov: 38 }}
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
        <i className="ph-fill ph-arrows-clockwise" /> {flipped ? 'Mostra il fronte' : 'Gira la carta'}
      </button>
    </div>
  );
}
