import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, DoubleSide, NormalBlending, Object3D } from 'three';

const NEON = ['#8B5CF6', '#EC4899', '#22D3EE', '#3B82F6', '#FFFFFF'];
const dummy = new Object3D();

/**
 * Stato iniziale di ogni particella. I numeri casuali vengono estratti una volta sola,
 * quando cambia il numero di particelle, e non a ogni fotogramma.
 */
function createParticles(count, speed, spread) {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.35 + Math.random() * 0.9);
    return {
      x: (Math.random() - 0.5) * 0.15,
      y: (Math.random() - 0.5) * spread,
      z: 0,
      vx: Math.cos(angle) * power,
      // Spinta verso l'alto: i coriandoli "zampillano" dalla fessura invece di cadere subito.
      vy: Math.sin(angle) * power * 0.8 + power * 0.5,
      vz: (Math.random() * 0.8 + 0.2) * power,
      rx: Math.random() * Math.PI,
      ry: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 14,
      size: 0.5 + Math.random() * 0.8,
      life: 0.8 + Math.random() * 1.1
    };
  });
}

/**
 * Esplosione di particelle con fisica minima (gravita' + attrito dell'aria).
 *
 * Tutte le particelle stanno in un solo InstancedMesh: una sola chiamata di disegno anche con
 * centinaia di pezzi, che su mobile fa la differenza. Le scintille hanno il colore spinto oltre 1
 * e blending additivo: sovrapponendosi diventano quasi bianche, come una luce vera.
 *
 * `variant="confetti"`: striscioline di foil che ruotano e cadono piano.
 * `variant="sparks"`: scintille piccole e veloci che si spengono rimpicciolendo.
 */
export default function ConfettiBurst({ count, color, active, variant = 'confetti' }) {
  const meshRef = useRef(null);
  const elapsed = useRef(0);
  const sparks = variant === 'sparks';

  const particles = useMemo(
    () => createParticles(count, sparks ? 7 : 4.2, sparks ? 2.4 : 2.8),
    [count, sparks]
  );

  // I colori si scrivono una sola volta: meta' particelle con il colore della rarita',
  // le altre con i neon dell'app.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const tint = new Color();
    particles.forEach((_, i) => {
      const source = i % 2 === 0 ? color : NEON[i % NEON.length];
      tint.set(source).multiplyScalar(sparks ? 1.6 : 1);
      mesh.setColorAt(i, tint);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [particles, color, sparks]);

  useEffect(() => {
    if (active) elapsed.current = 0;
  }, [active]);

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = active;
    if (!active) return;

    // Il delta viene limitato: dopo un cambio di scheda arriverebbe un salto enorme e le
    // particelle sparirebbero tutte in un fotogramma.
    const delta = Math.min(rawDelta, 1 / 30);
    elapsed.current += delta;
    const t = elapsed.current;
    // Velocita' con attrito esponenziale: lo spostamento e' v * (1 - e^(-k t)) / k.
    const k = sparks ? 2.4 : 1.6;
    const travel = (1 - Math.exp(-k * t)) / k;
    const fall = 0.5 * (sparks ? 0.8 : 1.2) * t * t;

    particles.forEach((p, i) => {
      const fade = Math.max(0, 1 - t / p.life);
      dummy.position.set(
        p.x + p.vx * travel,
        p.y + p.vy * travel - fall,
        p.z + p.vz * travel
      );
      dummy.rotation.set(p.rx + p.spin * t, p.ry + p.spin * 0.7 * t, 0);
      const s = p.size * (sparks ? fade : Math.min(1, fade * 2.5));
      dummy.scale.setScalar(Math.max(s, 0.0001));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false} visible={false}>
      {sparks
        ? <planeGeometry args={[0.035, 0.035]} />
        : <planeGeometry args={[0.07, 0.13]} />}
      <meshBasicMaterial
        toneMapped={false}
        side={DoubleSide}
        transparent
        blending={sparks ? AdditiveBlending : NormalBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
