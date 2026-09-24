import { Color, DoubleSide, Vector2 } from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

/**
 * Foil olografico condiviso da carte e pacchetti.
 *
 * Il colore di base e' l'artwork. Sopra ci sono tre strati leggeri che dipendono dall'angolo
 * da cui si guarda la superficie, come su una carta foil vera:
 * - una banda iridescente sottile che compare solo inclinando (uTilt) e sul bordo (fresnel);
 * - rare scintille su una griglia, sfasate nel tempo;
 * - un riflesso morbido che si sposta in direzione opposta all'inclinazione.
 *
 * Gestisce anche due cose che altrimenti richiederebbero geometrie dedicate:
 * - gli angoli arrotondati, tagliati con una distanza da rettangolo smussato;
 * - lo strappo del pacchetto: con uSide = -1 o 1 il piano tiene solo la meta' sinistra o
 *   destra lungo una linea seghettata, e il bordo dello strappo si accende con uSeamColor.
 *   Le due meta' usano la stessa linea, quindi finche' sono ferme combaciano perfettamente.
 */
const HoloMaterial = shaderMaterial(
  {
    uMap: null,
    uTime: 0,
    uTilt: new Vector2(0, 0),
    uIntensity: 0.4,
    uSize: new Vector2(2.5, 3.5),
    uRadius: 0.14,
    uUvScale: new Vector2(1, 1),
    uSide: 0,
    uTear: 0,
    uSeamColor: new Color('#ffffff'),
    uOpacity: 1
  },
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(mat3(modelMatrix) * normal);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  /* glsl */ `
    uniform sampler2D uMap;
    uniform float uTime;
    uniform vec2 uTilt;
    uniform float uIntensity;
    uniform vec2 uSize;
    uniform float uRadius;
    uniform vec2 uUvScale;
    uniform float uSide;
    uniform float uTear;
    uniform vec3 uSeamColor;
    uniform float uOpacity;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(float x) {
      float i = floor(x);
      float f = fract(x);
      return mix(hash(vec2(i, 1.7)), hash(vec2(i + 1.0, 1.7)), smoothstep(0.0, 1.0, f));
    }

    float roundedBox(vec2 p, vec2 halfSize, float r) {
      vec2 q = abs(p) - halfSize + r;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }

    void main() {
      vec2 p = (vUv - 0.5) * uSize;
      if (roundedBox(p, uSize * 0.5, uRadius) > 0.0) discard;

      // Linea di strappo: due frequenze di rumore danno il bordo di carta lacerata.
      float seam = 0.5
        + (noise(vUv.y * 14.0) - 0.5) * 0.07
        + (noise(vUv.y * 70.0 + 5.0) - 0.5) * 0.025;
      if (uSide < -0.5 && vUv.x > seam) discard;
      if (uSide > 0.5 && vUv.x < seam) discard;

      // Copertura dell'artwork come object-fit: cover, cosi' le immagini non si deformano.
      vec2 uv = (vUv - 0.5) * uUvScale + 0.5;
      vec4 tex = texture2D(uMap, uv);
      if (tex.a < 0.02) discard;
      vec3 base = tex.rgb;

      vec3 n = normalize(vNormal);
      if (!gl_FrontFacing) n = -n;
      float fresnel = pow(1.0 - clamp(abs(dot(n, normalize(vViewDir))), 0.0, 1.0), 3.0);

      // Il foil e' volutamente discreto: una sola banda sottile che compare solo inclinando,
      // senza animazione nel tempo, cosi' l'artwork resta leggibile.
      float band = vUv.x * 1.1 + vUv.y * 0.7 + uTilt.x * 0.8 - uTilt.y * 0.6;
      vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (band + vec3(0.0, 0.33, 0.67)));
      float sheen = smoothstep(0.8, 1.0, sin(band * 5.0) * 0.5 + 0.5);
      float tiltAmount = clamp(length(uTilt) * 2.0, 0.0, 1.0);

      vec3 col = base;
      col += rainbow * uIntensity * (0.22 * sheen * tiltAmount + 0.25 * fresnel);

      vec2 cell = floor(vUv * vec2(48.0, 66.0));
      float h = hash(cell);
      float twinkle = pow(sin(uTime * 1.2 + h * 60.0) * 0.5 + 0.5, 8.0);
      col += step(0.992, h) * twinkle * uIntensity * 0.8;

      vec2 glarePos = vec2(0.5) - uTilt * 0.7;
      col += smoothstep(0.5, 0.0, distance(vUv, glarePos)) * 0.15 * uIntensity * tiltAmount;

      if (abs(uSide) > 0.5) {
        float d = abs(vUv.x - seam);
        col += uSeamColor * smoothstep(0.035, 0.0, d) * uTear * 4.0;
      }

      gl_FragColor = vec4(col, tex.a * uOpacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
  (material) => {
    material.side = DoubleSide;
    material.transparent = true;
  }
);

extend({ HoloMaterial });

/**
 * Scala delle coordinate texture per ottenere l'effetto "cover" su un piano di
 * larghezza/altezza date, qualunque sia il formato dell'immagine.
 */
export function coverScale(texture, width, height) {
  const img = texture?.image;
  if (!img?.width || !img?.height) return new Vector2(1, 1);
  const planeAspect = width / height;
  const imageAspect = img.width / img.height;
  return imageAspect > planeAspect
    ? new Vector2(planeAspect / imageAspect, 1)
    : new Vector2(1, imageAspect / planeAspect);
}

export default HoloMaterial;
