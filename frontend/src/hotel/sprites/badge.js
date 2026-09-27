/**
 * Distintivo indossato accanto al nome: uno scudetto a pixel nel colore della sua famiglia
 * (set, livello, collezione, battaglie) con dentro l'icona del distintivo.
 * L'icona e' un glifo del font Phosphor, lo stesso delle icone della pagina.
 */

/** Misure dello scudetto a zoom 1. */
export const BADGE_W = 11;
export const BADGE_H = 13;

/** Risoluzione interna dello sprite: resta nitido anche ingrandito. */
const RES = 4;

const FAMILY_COLORS = [
  ['set-', '#a855f7'],
  ['level', '#22d3ee'],
  ['collector', '#22c55e'],
  ['legend', '#f59e0b'],
  ['champion', '#ef4444'],
  ['fighter', '#ef4444']
];

export function badgeColor(code = '') {
  return FAMILY_COLORS.find(([prefix]) => code.startsWith(prefix))?.[1] || '#8b5cf6';
}

const glyphs = new Map();

/** Carattere e font di un'icona Phosphor, letti da un elemento nascosto (null se non pronto). */
function glyphOf(icon) {
  if (glyphs.has(icon)) return glyphs.get(icon);
  if (typeof document === 'undefined' || !document.body) return null;
  const el = document.createElement('i');
  el.className = `ph-fill ph-${icon}`;
  el.style.cssText = 'position:absolute;left:-9999px;top:0;';
  document.body.appendChild(el);
  const style = getComputedStyle(el, '::before');
  const content = style.content;
  const family = style.fontFamily;
  el.remove();
  const ch = content && content !== 'none' && content !== 'normal' ? content.replace(/^["']|["']$/g, '') : '';
  if (!ch) return null;
  // Finche' il font non e' caricato il glifo uscirebbe come un quadratino: si riprova dopo.
  if (document.fonts && !document.fonts.check(`16px ${family}`)) {
    document.fonts.load(`16px ${family}`).catch(() => {});
    return null;
  }
  const glyph = { ch, family };
  glyphs.set(icon, glyph);
  return glyph;
}

const sprites = new Map();

/** Sprite dello scudetto: senza icona pronta si disegna una stella e non si mette in cache. */
export function badgeSprite(badge) {
  const key = `${badge.code}:${badge.icon}`;
  if (sprites.has(key)) return sprites.get(key);
  const glyph = badge.icon ? glyphOf(badge.icon) : null;
  const w = BADGE_W * RES;
  const h = BADGE_H * RES;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const color = badgeColor(badge.code);

  const shield = (inset) => {
    ctx.beginPath();
    ctx.moveTo(inset, inset);
    ctx.lineTo(w - inset, inset);
    ctx.lineTo(w - inset, h * 0.58);
    ctx.quadraticCurveTo(w - inset, h * 0.82, w / 2, h - inset);
    ctx.quadraticCurveTo(inset, h * 0.82, inset, h * 0.58);
    ctx.closePath();
  };
  // Bordo scuro, cornice d'oro, fondo nel colore della famiglia con un riflesso.
  ctx.fillStyle = '#140d24';
  shield(0);
  ctx.fill();
  ctx.fillStyle = '#ffd24a';
  shield(RES * 0.8);
  ctx.fill();
  ctx.fillStyle = color;
  shield(RES * 1.8);
  ctx.fill();
  const shine = ctx.createLinearGradient(0, 0, w, h);
  shine.addColorStop(0, 'rgba(255,255,255,.45)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  shield(RES * 1.8);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glyph) {
    ctx.font = `${Math.round(w * 0.58)}px ${glyph.family}`;
    ctx.fillText(glyph.ch, w / 2, h * 0.47);
  } else {
    const r = w * 0.24;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(w / 2 + Math.cos(a) * rad, h * 0.47 + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (glyph || !badge.icon) sprites.set(key, canvas);
  return canvas;
}

/** Scudetto con il fondo in bottom e il bordo sinistro in x. */
export function drawBadge(ctx, x, bottom, badge, scale) {
  const w = BADGE_W * scale;
  const h = BADGE_H * scale;
  ctx.drawImage(badgeSprite(badge), Math.round(x), Math.round(bottom - h), w, h);
}
