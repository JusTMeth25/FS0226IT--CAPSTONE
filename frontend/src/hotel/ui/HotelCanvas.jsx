import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { HotelEngine } from '../HotelEngine.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

/** Oltre questo spostamento (pixel) il gesto e' un trascinamento della vista, non un clic. */
const DRAG_THRESHOLD = 5;

/**
 * Canvas della stanza. Crea il motore grafico, lo tiene della misura del contenitore e
 * traduce mouse e dita in comandi: clic su una casella per camminare, clic su un avatar per
 * aprire la sua scheda, trascinamento per spostare la vista.
 *
 * Il genitore passa i messaggi del server con ref.current.handle(message).
 */
const HotelCanvas = forwardRef(function HotelCanvas({ zoom, catalog, placement, buildMode, onTileClick, onAvatarClick, onItemClick, onPlace }, ref) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const callbacks = useRef({ onTileClick, onAvatarClick, onItemClick, onPlace });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    callbacks.current = { onTileClick, onAvatarClick, onItemClick, onPlace };
  }, [onTileClick, onAvatarClick, onItemClick, onPlace]);

  useImperativeHandle(ref, () => ({
    handle: (message) => engineRef.current?.handle(message),
    pulse: () => engineRef.current?.pulse()
  }), []);

  useEffect(() => {
    const engine = new HotelEngine(canvasRef.current, {
      onTileClick: (tile) => callbacks.current.onTileClick?.(tile),
      onAvatarClick: (user) => callbacks.current.onAvatarClick?.(user),
      onItemClick: (item, tile) => callbacks.current.onItemClick?.(item, tile),
      onPlace: (tile, current) => callbacks.current.onPlace?.(tile, current)
    });
    engineRef.current = engine;

    const wrap = wrapRef.current;
    const observer = new ResizeObserver(() => {
      engine.resize(wrap.clientWidth, wrap.clientHeight, Math.min(window.devicePixelRatio || 1, 2));
    });
    observer.observe(wrap);

    // L'hotel resta aperto a lungo: con la scheda nascosta non si disegna nulla.
    const onVisibility = () => (document.hidden ? engine.stop() : engine.start());
    document.addEventListener('visibilitychange', onVisibility);
    engine.start();

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  // Cambiare la preferenza non ricrea il motore: perderebbe la stanza gia' caricata.
  useEffect(() => {
    if (engineRef.current) engineRef.current.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    engineRef.current?.setZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.catalog = new Map((catalog || []).map((def) => [def.type, def]));
  }, [catalog]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.placement = placement || null;
  }, [placement]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.buildMode = !!buildMode;
  }, [buildMode]);

  const gesture = useRef(null);

  const local = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event) => {
    const p = local(event);
    gesture.current = { startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, dragging: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const engine = engineRef.current;
    const p = local(event);
    const g = gesture.current;
    if (g) {
      if (!g.dragging && Math.hypot(p.x - g.startX, p.y - g.startY) > DRAG_THRESHOLD) g.dragging = true;
      if (g.dragging) {
        engine?.pan(p.x - g.lastX, p.y - g.lastY);
        g.lastX = p.x;
        g.lastY = p.y;
        return;
      }
    }
    engine?.pointerMove(p.x, p.y);
  };

  const onPointerUp = (event) => {
    const g = gesture.current;
    gesture.current = null;
    if (g && !g.dragging) {
      const p = local(event);
      engineRef.current?.click(p.x, p.y);
    }
  };

  return (
    <div ref={wrapRef} className="hotel-canvas-wrap">
      <canvas
        ref={canvasRef}
        className={`hotel-canvas${placement ? ' placing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null; }}
        aria-label="Stanza dell'hotel: tocca una casella per camminare, un avatar per vedere chi e'"
        role="img"
      />
    </div>
  );
});

export default HotelCanvas;
