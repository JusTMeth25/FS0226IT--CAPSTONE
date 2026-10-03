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
    uOpacity: 1,
    uFoil: 0,
    // Finitura olografica come nella collezione (FINISH_IDS): 0 nessuna.
    uFinish: 0,
    // 1 sulle carte Pokemon: holo e cosmos solo nell'illustrazione, reverse solo fuori.
    uArtMask: 0
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
    uniform float uFoil;
    uniform float uFinish;
    uniform float uArtMask;

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

    vec3 spectrum(float t) {
      return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
    }

    // Disegno della finitura (stesse famiglie di holo-finish.css), tra 0 e 1 per canale.
    // p: posizione sulla carta (0-1), t: inclinazione, l: posizione della luce.
    vec3 finishPattern(float f, vec2 p, vec2 t, vec2 l, float time) {
      float d = distance(p, l);
      if (f < 1.5) { // reverse
        return spectrum(p.x * 0.6 + p.y * 0.4 - t.x) * 0.6 + smoothstep(0.45, 0.0, d) * 0.6;
      }
      if (f < 2.5) { // holo: barre verticali
        float bars = step(0.5, fract(p.y * 90.0));
        return spectrum(p.x * 3.5 - t.x * 2.0) * (0.75 + 0.25 * bars);
      }
      if (f < 3.5) { // cosmos
        vec2 c = floor((p + t * 0.1) * vec2(60.0, 84.0));
        float star = step(0.985, hash(c));
        return spectrum(p.x * 0.8 - p.y * 0.6 - t.x) * 0.8 + star;
      }
      if (f < 4.5) { // amazing
        float a = atan(p.y - l.y, p.x - l.x) / 6.28318;
        float glit = step(0.97, hash(floor(p * vec2(55.0, 77.0))));
        return spectrum(a + t.x) * 0.9 + glit;
      }
      if (f < 5.5) { // radiant: rombi
        float g = max(step(0.92, fract((p.x + p.y) * 22.0)), step(0.92, fract((p.x - p.y) * 22.0)));
        return vec3(0.7, 0.75, 0.85) * g + spectrum(p.x - t.x) * 0.3;
      }
      if (f < 6.5) { // ultra: fasce diagonali
        float band = smoothstep(0.82, 1.0, fract((p.x + p.y) * 7.0 + t.x * 2.0 - t.y));
        return spectrum(p.x * 1.2 + p.y * 0.4 - t.x) * (0.45 + band);
      }
      if (f < 7.5) { // vmax: blocchi larghi
        float blk = step(0.6, fract(p.x * 4.0 + p.y * 7.0 + t.x));
        return spectrum(p.y * 1.4 - t.y * 2.0) * (0.4 + 0.6 * blk);
      }
      if (f < 8.5) { // vstar: righe sottili
        float line = step(0.7, fract((p.x * 0.5 - p.y) * 70.0));
        return spectrum(p.x * 2.0 - t.x * 2.5) * (0.5 + 0.5 * line);
      }
      if (f < 9.5) { // vfull: incisione orizzontale
        float line = step(0.6, fract(p.y * 140.0));
        return spectrum(p.x + p.y * 0.5 - t.x) * (0.35 + 0.4 * line);
      }
      if (f < 10.5) { // rainbow
        float glit = step(0.96, hash(floor(p * vec2(80.0, 112.0))));
        return mix(spectrum(p.x * 1.4 - t.x * 1.5), vec3(1.0), 0.25) + glit * 0.6;
      }
      if (f < 11.5) { // secret: oro
        float glit = hash(floor(p * vec2(90.0, 126.0) + floor(t * 6.0)));
        return vec3(1.0, 0.78, 0.35) * (0.45 + 0.6 * step(0.8, glit)) + smoothstep(0.4, 0.0, d) * vec3(1.0, 0.9, 0.6);
      }
      if (f < 12.5) { // shiny: argento
        float glit = hash(floor(p * vec2(100.0, 140.0) + floor(t * 8.0)));
        return vec3(0.82, 0.88, 1.0) * (0.35 + 0.65 * step(0.82, glit)) + smoothstep(0.4, 0.0, d) * 0.5;
      }
      if (f < 13.5) { // gallery: pastello
        return mix(spectrum(p.x * 0.8 + p.y * 0.3 - t.x), vec3(1.0), 0.35) * 0.8 + smoothstep(0.45, 0.0, d) * 0.4;
      }
      // illustration: stelle su tre piani e aurora
      float s1 = step(0.988, hash(floor((p + t * 0.04) * vec2(70.0, 98.0))));
      float s2 = step(0.985, hash(floor((p - t * 0.08) * vec2(36.0, 50.0)) + 3.1));
      return spectrum(p.x * 0.9 - p.y * 0.5 - t.x) * 0.6 + (s1 + s2) * 0.9;
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

      // Copia olografica (uFoil): arcobaleno pieno come nella collezione, una banda diagonale che
      // scorre da sola e segue l'inclinazione, schiarendo i colori (color-dodge) invece di coprirli.
      if (uFoil > 0.0) {
        float diag = vUv.x * 0.8 + (1.0 - vUv.y) * 0.6 + uTilt.x * 1.2 - uTilt.y * 0.8 - uTime * 0.18;
        vec3 prism = 0.5 + 0.5 * cos(6.28318 * (diag * 1.6 + vec3(0.0, 0.33, 0.67)));
        float sweep = pow(0.5 + 0.5 * sin(diag * 6.28318), 3.0);
        vec3 blend = prism * uFoil * (0.18 + 0.4 * sweep);
        col = min(vec3(1.0), col / max(vec3(0.25), 1.0 - blend));
        col += prism * uFoil * 0.06;
        col += step(0.985, h) * pow(sin(uTime * 2.3 + h * 90.0) * 0.5 + 0.5, 6.0) * uFoil * 0.45;
      }

      // Finitura della carta: colori che schiariscono l'immagine (come color-dodge in CSS),
      // un velo a riposo e piena quando la carta si inclina.
      if (uFinish > 0.5) {
        vec2 light = vec2(0.5) - uTilt * 0.8;
        vec3 pat = finishPattern(uFinish, vUv, uTilt, light, uTime);
        float inArt = step(0.08, vUv.x) * step(vUv.x, 0.92) * step(0.48, vUv.y) * step(vUv.y, 0.91);
        float mask = 1.0;
        if (uArtMask > 0.5 && (uFinish > 1.5 && uFinish < 3.5)) mask = inArt;
        if (uArtMask > 0.5 && uFinish < 1.5) mask = 1.0 - inArt;
        float strength = (0.25 + 0.55 * tiltAmount) * mask;
        vec3 dodge = clamp(pat * strength * 0.55, 0.0, 0.85);
        col = min(vec3(1.0), col / max(vec3(0.2), 1.0 - dodge));
      }

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

/** Numero della finitura per lo shader (vedi finishPattern), dal nome usato in CSS. */
export const FINISH_IDS = {
  reverse: 1, holo: 2, cosmos: 3, amazing: 4, radiant: 5, ultra: 6, vmax: 7, vstar: 8,
  vfull: 9, rainbow: 10, secret: 11, shiny: 12, gallery: 13, illustration: 14
};

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
