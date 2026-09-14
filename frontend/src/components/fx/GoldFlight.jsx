import { useEffect, useRef } from 'react';
import { useGame } from '../../hooks/useGame.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

/** Selettore della pilla del gold nella barra in alto: e' li' che atterrano le monete. */
const TARGET_SELECTOR = '.topbar-gold-pill';

const MIN_COINS = 3;
const MAX_COINS = 12;
const FLIGHT_MS = 820;
const STAGGER_MS = 45;

/**
 * Quanto aspettare dall'avvio prima di considerare reali le variazioni di saldo.
 * All'accesso il gold passa dal valore iniziale a quello del profilo: e' il
 * caricamento dei dati, non una vincita.
 */
const SETTLE_MS = 1500;

/**
 * Monete che volano dal punto dell'azione al contatore del gold.
 *
 * Il guadagno di gold avviene in una decina di punti diversi (missioni, mercato, battaglie,
 * bonus di accesso) e ognuno aggiorna solo lo stato. Questo componente non si aggancia a
 * nessuno di quei punti: osserva il saldo e reagisce quando sale, quindi funziona anche per
 * le fonti di guadagno che verranno aggiunte dopo.
 *
 * Il punto di partenza e' l'ultimo clic: e' li' che l'utente stava guardando.
 */
export default function GoldFlight() {
  const { gold } = useGame();
  const reduced = useReducedMotion();

  const layerRef = useRef(null);
  const previousGold = useRef(gold);
  const ready = useRef(false);
  const origin = useRef(null);

  useEffect(() => {
    const settleTimer = setTimeout(() => { ready.current = true; }, SETTLE_MS);

    const onPointerDown = (event) => {
      origin.current = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      clearTimeout(settleTimer);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, []);

  useEffect(() => {
    const delta = gold - previousGold.current;
    previousGold.current = gold;

    // Due condizioni, entrambe necessarie:
    //   - i dati iniziali si sono assestati, quindi questo e' un guadagno vero
    //   - c'e' stato un clic, quindi esiste un punto da cui far partire le monete
    // La seconda esclude anche il caso dell'accesso, dove il saldo arriva dal server
    // senza che l'utente abbia fatto niente in pagina.
    if (!ready.current || !origin.current) return undefined;
    if (reduced || delta <= 0) return undefined;

    const layer = layerRef.current;
    const target = document.querySelector(TARGET_SELECTOR);
    if (!layer || !target) return undefined;

    const targetRect = target.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    const start = origin.current;

    // Piu' gold, piu' monete, ma entro un limite: oltre la dozzina non si distinguono
    // e si paga solo il costo di animarle.
    const coins = Math.max(MIN_COINS, Math.min(MAX_COINS, Math.round(Math.sqrt(delta))));
    const animations = [];
    const nodes = [];

    const label = document.createElement('span');
    label.className = 'gold-flight-label';
    label.textContent = `+${delta}`;
    label.style.left = `${start.x}px`;
    label.style.top = `${start.y}px`;
    layer.appendChild(label);
    nodes.push(label);

    for (let i = 0; i < coins; i++) {
      const coin = document.createElement('span');
      coin.className = 'gold-flight-coin';
      layer.appendChild(coin);
      nodes.push(coin);

      // Ogni moneta parte leggermente spostata e sale prima di curvare verso il
      // contatore: una linea retta sembrerebbe un cursore che scivola, non un lancio.
      const spreadX = (Math.random() - 0.5) * 70;
      const spreadY = (Math.random() - 0.5) * 50;
      const arcX = start.x + (endX - start.x) * 0.35 + spreadX;
      const arcY = Math.min(start.y, endY) - 70 + spreadY;

      animations.push(coin.animate(
        [
          { transform: `translate(${start.x}px, ${start.y}px) scale(0.4)`, opacity: 0 },
          { transform: `translate(${start.x + spreadX}px, ${start.y + spreadY}px) scale(1)`, opacity: 1, offset: 0.12 },
          { transform: `translate(${arcX}px, ${arcY}px) scale(1.1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${endX}px, ${endY}px) scale(0.35)`, opacity: 0 }
        ],
        {
          duration: FLIGHT_MS,
          delay: i * STAGGER_MS,
          easing: 'cubic-bezier(0.35, 0, 0.3, 1)',
          fill: 'forwards'
        }
      ));
    }

    // Il contatore reagisce quando la prima moneta arriva, non quando parte.
    const pulseTimer = setTimeout(() => target.classList.add('gold-pill-hit'), FLIGHT_MS - 120);
    const cleanTimer = setTimeout(() => target.classList.remove('gold-pill-hit'), FLIGHT_MS + 500);
    const removeTimer = setTimeout(() => nodes.forEach((n) => n.remove()), FLIGHT_MS + coins * STAGGER_MS + 120);

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(cleanTimer);
      clearTimeout(removeTimer);
      animations.forEach((a) => a.cancel());
      nodes.forEach((n) => n.remove());
      target.classList.remove('gold-pill-hit');
    };
  }, [gold, reduced]);

  return <div className="gold-flight-layer" ref={layerRef} aria-hidden="true" />;
}
