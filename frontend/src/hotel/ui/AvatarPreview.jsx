import { useEffect, useRef } from 'react';
import { AVATAR_H, AVATAR_W, avatarSprite } from '../sprites/avatar.js';

/**
 * Avatar disegnato fuori dalla stanza (guardaroba, scheda utente), ingrandito a pixel netti.
 * Con `walking` cammina sul posto, per vedere anche le gambe in movimento.
 */
export default function AvatarPreview({ look, scale = 4, back = false, flip = false, walking = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;

    const draw = (now) => {
      const frame = walking ? Math.floor(now / 150) % 4 : 0;
      const sprite = avatarSprite(look, { back, flip, pose: walking ? 'walk' : 'stand', frame });
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sprite, 0, 0, AVATAR_W * scale, AVATAR_H * scale);
      if (walking) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [look, scale, back, flip, walking]);

  return (
    <canvas
      ref={canvasRef}
      className="hotel-avatar-preview"
      width={AVATAR_W * scale}
      height={AVATAR_H * scale}
      aria-hidden="true"
    />
  );
}
