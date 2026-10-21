import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, MathUtils } from 'three';
import { getRarityColor } from '../../utils/cardUtils.js';
import { getTier } from './rarityTiers.js';
import { coverScale } from './holoMaterial.js';
import { useSafeTexture } from './textures.js';
import { useDocumentVisible } from './useThreeEnabled.js';
import { isSafeMode } from '../../services/accessibility.js';
import ConfettiBurst from './ConfettiBurst.jsx';
import VinylDisc from './VinylDisc.jsx';

const PACK_W = 2.2;
const PACK_H = 3.0;
const CAMERA_Z = 6;

/*
 * I piani luminosi usano blending additivo con alpha premoltiplicato: il colore si somma cosi'
 * com'e' e l'alpha segue la luminosita'. Con alpha fisso a 1 il canvas trasparente
 * mostrerebbe un rettangolo nero dove la luce e' spenta.
 */
const QUAD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Ventaglio di raggi che gira dietro al pacchetto: compare solo dalle rare in su. */
const RAYS_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float angle = atan(p.y, p.x);
    float rays = pow(abs(sin(angle * 9.0 + uTime * 0.5)), 10.0)
               + 0.6 * pow(abs(sin(angle * 5.0 - uTime * 0.3)), 16.0);
    float falloff = smoothstep(0.5, 0.05, length(p));
    vec3 col = uColor * rays * falloff * uOpacity * 1.6;
    gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
  }
`;

/**
 * Luce morbida e rotonda: l'ellisse arriva a zero prima dei bordi del piano, cosi' anche
 * allargata non mostra mai un contorno rettangolare. Usata per la fessura e per il lampo.
 */
const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length((vUv - 0.5) * 2.0);
    float core = smoothstep(1.0, 0.0, d);
    vec3 col = uColor * (core * core * 2.5 + core * 0.6) * uOpacity;
    gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
  }
`;

function additiveUniforms(color) {
  return {
    uColor: { value: new Color(color) },
    uTime: { value: 0 },
    uOpacity: { value: 0 }
  };
}

function PackScene({ packImage, packRarity, bestRarity, dragProgress, dragging, torn }) {
  const texture = useSafeTexture(packImage, 'V', '#8B5CF6', { transparentBackground: true });
  const bestColor = getRarityColor(bestRarity);
  const tier = getTier(bestRarity);
  const packTier = getTier(packRarity);

  const rigRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const leftMatRef = useRef(null);
  const rightMatRef = useRef(null);
  const glowRef = useRef(null);
  const raysRef = useRef(null);
  const flashRef = useRef(null);
  const progress = useRef(0);
  const tornAt = useRef(null);

  const uvScale = useMemo(() => coverScale(texture, PACK_W, PACK_H), [texture]);
  const glowUniforms = useMemo(() => additiveUniforms(bestColor), [bestColor]);
  const raysUniforms = useMemo(() => additiveUniforms(bestColor), [bestColor]);
  const flashUniforms = useMemo(() => additiveUniforms('#ffffff'), []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const t = state.clock.elapsedTime;
    const rig = rigRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!rig || !left || !right) return;

    // Il progresso segue il dito con un filo di inerzia; a strappo avvenuto resta a 1.
    progress.current = torn ? 1 : MathUtils.damp(progress.current, dragProgress, dragging ? 18 : 8, delta);
    const p = progress.current;

    if (torn && tornAt.current === null) tornAt.current = t;
    if (!torn) tornAt.current = null;
    const since = tornAt.current === null ? 0 : t - tornAt.current;
    const burst = MathUtils.clamp(since / 0.9, 0, 1);
    const eased = 1 - (1 - burst) ** 3;
    // Modalita' sicura (fotosensibilita'): all'apertura niente lampo bianco, niente picco del
    // bagliore e dei raggi, niente scossa; le due meta' si aprono lo stesso.
    const safe = isSafeMode();

    // A riposo il pacchetto fluttua e guarda verso il puntatore; mentre lo strappi sta fermo.
    const idle = !dragging && !torn;
    rig.rotation.y = MathUtils.damp(rig.rotation.y, idle ? state.pointer.x * 0.35 + Math.sin(t * 0.6) * 0.12 : 0, 4, delta);
    rig.rotation.x = MathUtils.damp(rig.rotation.x, idle ? -state.pointer.y * 0.25 : 0, 4, delta);
    rig.position.y = Math.sin(t * 1.2) * 0.06 * (1 - p);

    // Vicino al punto di rottura la carta vibra, come quando sta per cedere.
    const tremble = !torn && p > 0.3 ? (p - 0.3) * 0.05 : 0;
    const jitter = () => (Math.random() - 0.5) * tremble;

    left.position.set(-(p * 0.3 + eased * 3.4) + jitter(), -eased * 0.7 + jitter(), eased * 1.1);
    left.rotation.set(0, -(p * 0.45 + eased * 1.5), p * 0.16 + eased * 0.9);
    right.position.set(p * 0.3 + eased * 3.4 + jitter(), -eased * 0.7 + jitter(), eased * 1.1);
    right.rotation.set(0, p * 0.45 + eased * 1.5, -(p * 0.16 + eased * 0.9));

    const fadeOut = 1 - MathUtils.smoothstep(burst, 0.45, 1);
    [leftMatRef.current, rightMatRef.current].forEach((mat) => {
      if (!mat) return;
      mat.uTime = t;
      mat.uTilt.set(rig.rotation.y, rig.rotation.x);
      mat.uTear = Math.min(1, p * 1.4);
      mat.uOpacity = fadeOut;
    });

    const glow = glowRef.current;
    if (glow) {
      glow.scale.set(0.12 + p * 1.1 + eased * 5, 1 + p * 0.3 + eased * 1.5, 1);
      glow.material.uniforms.uOpacity.value = p * 1.1 + (torn && !safe ? (1 - burst) * 2.2 : 0);
    }

    const rays = raysRef.current;
    if (rays) {
      rays.visible = tier.rays;
      rays.material.uniforms.uTime.value = t;
      rays.material.uniforms.uOpacity.value = torn ? (safe ? Math.max(0, 0.5 - since * 0.25) : Math.max(0, 1.4 - since * 0.7)) : p * 0.5;
      rays.scale.setScalar(1 + eased * 0.8);
    }

    const flash = flashRef.current;
    if (flash) {
      flash.material.uniforms.uOpacity.value = torn && !safe && tier.shake > 0 ? Math.max(0, 1 - since / 0.4) * 1.2 : 0;
      flash.scale.setScalar(0.6 + Math.min(1, since / 0.4) * 1.2);
    }

    // Scossa della camera all'apertura (epic e leggendarie) e leggero avvicinamento mentre strappi.
    const shake = torn && !safe ? tier.shake * Math.max(0, 1 - since / 0.8) : 0;
    state.camera.position.set(
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake,
      CAMERA_Z - p * 0.35 - eased * 0.4
    );
  });

  return (
    <>
      <mesh ref={raysRef} position={[0, 0, -1]} visible={false}>
        <planeGeometry args={[9, 9]} />
        <shaderMaterial
          uniforms={raysUniforms}
          vertexShader={QUAD_VERTEX}
          fragmentShader={RAYS_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          premultipliedAlpha
          toneMapped={false}
        />
      </mesh>

      <mesh ref={glowRef} position={[0, 0, -0.15]}>
        <planeGeometry args={[1.6, PACK_H * 1.4]} />
        <shaderMaterial
          uniforms={glowUniforms}
          vertexShader={QUAD_VERTEX}
          fragmentShader={GLOW_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          premultipliedAlpha
          toneMapped={false}
        />
      </mesh>

      {texture && (
        <group ref={rigRef}>
          {[-1, 1].map((side) => (
            <mesh key={side} ref={side < 0 ? leftRef : rightRef}>
              <planeGeometry args={[PACK_W, PACK_H, 1, 1]} />
              <holoMaterial
                ref={side < 0 ? leftMatRef : rightMatRef}
                uMap={texture}
                uSize={[PACK_W, PACK_H]}
                uRadius={0}
                uUvScale={uvScale}
                uSide={side}
                uIntensity={packTier.holo}
                uSeamColor={bestColor}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      )}

      <group position={[0, 0, 0.2]}>
        <ConfettiBurst count={tier.confetti} color={bestColor} active={torn} />
        <ConfettiBurst count={tier.sparks} color={bestColor} active={torn} variant="sparks" />
      </group>

      {bestRarity === 'legendary' && <VinylDisc active={torn} />}

      <mesh ref={flashRef} position={[0, 0, 0.6]}>
        <planeGeometry args={[3, 3]} />
        <shaderMaterial
          uniforms={flashUniforms}
          vertexShader={QUAD_VERTEX}
          fragmentShader={GLOW_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          premultipliedAlpha
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

/**
 * Strappo del pacchetto in 3D.
 *
 * Il trascinamento resta gestito dalla pagina (stessi handler e stessa soglia della versione
 * CSS): qui arrivano solo `dragProgress`, `dragging` e `torn`, e la scena li trasforma in
 * immagini. Dalla fessura filtra la luce della carta migliore del pacchetto, cosi' chi sta
 * strappando intuisce cosa lo aspetta prima ancora della rivelazione.
 *
 * Niente post-processing: il composer rende opaco il canvas e dietro al pacchetto comparirebbe
 * un rettangolo. Il bagliore lo danno i piani additivi (luce della fessura, raggi, scintille).
 */
export default function PackTear3D({ handlers, bestRarity, ...sceneProps }) {
  const visible = useDocumentVisible();

  return (
    <div className="pack-3d-stage" {...handlers}>
      <Canvas
        flat
        dpr={[1, 1.5]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 0, CAMERA_Z], fov: 40 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <PackScene bestRarity={bestRarity} {...sceneProps} />
      </Canvas>
    </div>
  );
}
