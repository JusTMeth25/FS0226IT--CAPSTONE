import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import { getVinylTexture } from './textures.js';

/**
 * Vinile d'oro che esce dal pacchetto quando dentro c'e' una leggendaria.
 *
 * Parte piccolo dalla fessura, sale girando su se stesso e vola verso la camera: il passaggio
 * alla rivelazione avviene mentre il disco riempie lo schermo, come uno stacco di montaggio.
 */
export default function VinylDisc({ active, delay = 0.15 }) {
  const groupRef = useRef(null);
  const spinRef = useRef(null);
  const elapsed = useRef(0);
  const texture = useMemo(() => getVinylTexture(), []);

  useFrame((_, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;
    if (!active) {
      elapsed.current = 0;
      group.visible = false;
      return;
    }

    elapsed.current += Math.min(rawDelta, 1 / 30);
    const t = Math.max(0, elapsed.current - delay);
    group.visible = t > 0;

    const rise = MathUtils.smoothstep(t, 0, 0.7);
    const fly = MathUtils.smoothstep(t, 0.7, 1.6);
    group.position.set(0, rise * 0.35 - fly * 0.1, -0.2 + rise * 0.8 + fly * 3.2);
    group.scale.setScalar(0.15 + rise * 0.85);
    // All'inizio il disco e' di taglio (esce dalla fessura), poi si gira verso la camera.
    group.rotation.set(Math.PI / 2 - (1 - rise) * 1.2, 0, (1 - rise) * 0.4);

    if (spinRef.current) spinRef.current.rotation.y += Math.min(rawDelta, 1 / 30) * (6 + fly * 18);
  });

  return (
    <group ref={groupRef} visible={false}>
      <group ref={spinRef}>
        <mesh>
          <cylinderGeometry args={[1, 1, 0.03, 96, 1]} />
          <meshStandardMaterial attach="material-0" color="#FFD700" metalness={1} roughness={0.25} emissive="#7a5200" />
          <meshStandardMaterial attach="material-1" map={texture} metalness={0.6} roughness={0.35} emissive="#FFD700" emissiveMap={texture} emissiveIntensity={0.6} />
          <meshStandardMaterial attach="material-2" map={texture} metalness={0.6} roughness={0.35} emissive="#FFD700" emissiveMap={texture} emissiveIntensity={0.6} />
        </mesh>
      </group>
    </group>
  );
}
