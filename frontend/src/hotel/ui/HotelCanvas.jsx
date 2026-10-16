import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { HotelEngine } from '../HotelEngine.js';
import { isLiteDevice } from '../../utils/perfMode.js';
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
const HotelCanvas = forwardRef(function HotelCanvas({ walkKeys = true, zoom, onZoom, catalog, placement, buildMode, onTileClick, onAvatarClick, onItemClick, onPlace, onCardClick }, ref) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const callbacks = useRef({ onTileClick, onAvatarClick, onItemClick, onPlace, onCardClick });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    callbacks.current = { onTileClick, onAvatarClick, onItemClick, onPlace, onCardClick };
  }, [onTileClick, onAvatarClick, onItemClick, onPlace, onCardClick]);

  useImperativeHandle(ref, () => ({
    handle: (message) => engineRef.current?.handle(message),
    pulse: () => engineRef.current?.pulse(),
    setMaxFps: (fps) => engineRef.current?.setMaxFps(fps),
    setVillas: (rooms) => engineRef.current?.setVillas(rooms),
    setPlots: (rooms) => engineRef.current?.setPlots(rooms),
    snapshot: () => {
      const source = canvasRef.current;
      if (!source) return null;
      const k = Math.min(1, 800 / source.width);
      const shot = document.createElement('canvas');
      shot.width = Math.round(source.width * k);
      shot.height = Math.round(source.height * k);
      const ctx = shot.getContext('2d');
      ctx.fillStyle = '#120b26';
      ctx.fillRect(0, 0, shot.width, shot.height);
      ctx.drawImage(source, 0, 0, shot.width, shot.height);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.textAlign = 'right';
      ctx.fillText('VinylDex Hotel', shot.width - 10, shot.height - 10);
      try {
        return shot.toDataURL('image/jpeg', 0.78);
      } catch {
        return null;
      }
    }
  }), []);

  useEffect(() => {
    const engine = new HotelEngine(canvasRef.current, {
      onTileClick: (tile) => callbacks.current.onTileClick?.(tile),
      onAvatarClick: (user) => callbacks.current.onAvatarClick?.(user),
      onItemClick: (item, tile) => callbacks.current.onItemClick?.(item, tile),
      onPlace: (tile, current) => callbacks.current.onPlace?.(tile, current),
      onCardClick: (card) => callbacks.current.onCardClick?.(card)
    });
    engineRef.current = engine;

    const wrap = wrapRef.current;
    // Dispositivi leggeri: al massimo 1,5 pixel per punto (meno pixel da ridisegnare a ogni fotogramma).
    const fit = () => engine.resize(wrap.clientWidth, wrap.clientHeight, Math.min(window.devicePixelRatio || 1, isLiteDevice() ? 1.5 : 2));
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    // Safari su iPhone, girando il telefono, finisce di sistemare la pagina dopo l'ultimo
    // ResizeObserver: si rimisura ancora un attimo dopo, se no la stanza restava della misura vecchia.
    let refit = null;
    const onRotate = () => {
      clearTimeout(refit);
      refit = setTimeout(fit, 350);
    };
    window.addEventListener('orientationchange', onRotate);
    window.visualViewport?.addEventListener('resize', onRotate);

    // L'hotel resta aperto a lungo: con la scheda nascosta non si disegna nulla.
    const onVisibility = () => (document.hidden ? engine.stop() : engine.start());
    document.addEventListener('visibilitychange', onVisibility);
    engine.start();

    return () => {
      observer.disconnect();
      clearTimeout(refit);
      window.removeEventListener('orientationchange', onRotate);
      window.visualViewport?.removeEventListener('resize', onRotate);
      document.removeEventListener('visibilitychange', onVisibility);
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  // Cambiare la preferenza non ricrea il motore: perderebbe la stanza gia' caricata.
  useEffect(() => {
    if (engineRef.current) engineRef.current.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  /** Punto del canvas da tenere fermo al prossimo cambio di zoom (dita o mouse). */
  const zoomAnchor = useRef(null);
  useEffect(() => {
    engineRef.current?.setZoom(zoom, zoomAnchor.current);
    zoomAnchor.current = null;
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
  /**
   * Pizzico con due dita. Si legge dagli eventi touch, che dicono sempre quante dita ci sono
   * davvero: con i pointer event Safari su iPhone a volte non manda il rilascio di un dito e
   * il conto restava sbagliato (zoom che non partiva o andava a scatti). `pinched` resta vero
   * finche' non si alzano tutte le dita: alzando l'ultima non parte un passo per sbaglio.
   */
  const pinch = useRef(null);
  const pinched = useRef(false);
  const zoomRef = useRef(zoom);
  const onZoomRef = useRef(onZoom);
  useEffect(() => {
    zoomRef.current = zoom;
    onZoomRef.current = onZoom;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const two = (event) => {
      const rect = canvas.getBoundingClientRect();
      const [a, b] = [event.touches[0], event.touches[1]];
      return {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        mid: { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top }
      };
    };
    const onTouchStart = (event) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
      pinch.current = { distance: two(event).distance, zoom: zoomRef.current };
      pinched.current = true;
      gesture.current = null;
    };
    const onTouchMove = (event) => {
      if (!pinch.current || event.touches.length < 2) return;
      event.preventDefault();
      const { distance, mid } = two(event);
      const next = Math.round(Math.max(0.5, Math.min(2, pinch.current.zoom * (distance / pinch.current.distance))) * 100) / 100;
      if (next === zoomRef.current) return;
      zoomAnchor.current = mid;
      onZoomRef.current?.(next);
    };
    const onTouchEnd = (event) => {
      if (event.touches.length < 2) pinch.current = null;
      if (event.touches.length === 0) setTimeout(() => { pinched.current = false; }, 0);
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const local = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event) => {
    const p = local(event);
    if (pinched.current) return;
    // Il puntatore finto del controller non si puo' catturare: si va avanti lo stesso.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* puntatore del controller */ }
    gesture.current = { startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, dragging: false };
  };

  const onPointerMove = (event) => {
    const engine = engineRef.current;
    const p = local(event);
    if (pinched.current) return;
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
    if (pinched.current) {
      gesture.current = null;
      return;
    }
    const g = gesture.current;
    gesture.current = null;
    if (g && !g.dragging) {
      const p = local(event);
      engineRef.current?.click(p.x, p.y);
    }
  };

  /**
   * Frecce (tastiera o controller): si cammina nella direzione vista sullo schermo (le caselle sono
   * in diagonale). Tenendo premuto si allunga il percorso di una casella solo quando ne resta al
   * massimo una da fare: cosi' il server non ricalcola il percorso a ogni ripetizione del tasto e
   * l'avatar cammina dritto, senza scatti in avanti o passi indietro. Cambiando direzione si gira
   * dalla casella verso cui si sta gia' andando.
   */
  const walk = useRef({ dir: null, target: null, sentAt: 0 });
  const onKeyDown = (event) => {
    const steps = { ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1] };
    const step = steps[event.key];
    const engine = engineRef.current;
    // Durante un minigioco le frecce servono al gioco: camminare lo interromperebbe.
    if (!step || !engine || !walkKeys) return;
    const me = engine.users.get(engine.meId);
    if (!me) return;
    event.preventDefault();
    const w = walk.current;
    const queued = me.steps || [];
    const now = performance.now();
    const turning = w.dir !== event.key;
    // Stessa direzione e ancora strada davanti: si aspetta.
    if (!turning && queued.length > 1) return;
    const base = queued.length ? (turning ? queued[0] : queued[queued.length - 1]) : me.pos;
    const target = { x: Math.round(base.x) + step[0], y: Math.round(base.y) + step[1] };
    // Lo stesso passo appena chiesto: si aspetta la risposta del server.
    if (w.target && w.target.x === target.x && w.target.y === target.y && now - w.sentAt < 700) return;
    w.dir = event.key;
    w.target = target;
    w.sentAt = now;
    callbacks.current.onTileClick?.(target);
  };
  const onKeyUp = (event) => {
    if (event.key === walk.current.dir) walk.current.dir = null;
  };

  return (
    <div ref={wrapRef} className="hotel-canvas-wrap">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        data-pad-initial
        role="application"
        aria-label="Stanza dell'hotel: clicca o usa le frecce della tastiera per camminare"
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        className={`hotel-canvas${placement ? ' placing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null; }}
        onWheel={(event) => {
          zoomAnchor.current = local(event);
          onZoom?.(Math.max(0.5, Math.min(2, Math.round((zoom - Math.sign(event.deltaY) * 0.1) * 10) / 10)));
        }}
        aria-label="Stanza dell'hotel: tocca una casella per camminare, un avatar per vedere chi e'"
        role="img"
      />
    </div>
  );
});

export default HotelCanvas;
