import { useEffect, useRef } from 'react';
import { furniSprite } from '../sprites/furni.js';

/**
 * Mobile disegnato fuori dalla stanza, per negozio e inventario. Lo sprite viene ritagliato
 * sui pixel pieni, cosi' mobili piccoli e grandi stanno centrati nella stessa casella.
 */
export default function FurniPreview({ type, def, scale = 2, size = 64 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !def) return;
    const { canvas: sprite } = furniSprite({ id: `preview-${type}`, type, x: 0, y: 0, rot: 0 }, def, { now: 0 });

    // Rettangolo dei pixel non trasparenti.
    const data = sprite.getContext('2d').getImageData(0, 0, sprite.width, sprite.height).data;
    let minX = sprite.width; let minY = sprite.height; let maxX = 0; let maxY = 0;
    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 0; x < sprite.width; x += 1) {
        if (data[(y * sprite.width + x) * 4 + 3] > 0) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    if (maxX < minX) return;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const fit = Math.min(scale, Math.floor(size / Math.max(w, h)) || 1);
    ctx.drawImage(sprite, minX, minY, w, h, (size - w * fit) / 2, (size - h * fit) / 2, w * fit, h * fit);
  }, [type, def, scale, size]);

  return <canvas ref={canvasRef} className="hotel-furni-preview" width={size} height={size} aria-hidden="true" />;
}
