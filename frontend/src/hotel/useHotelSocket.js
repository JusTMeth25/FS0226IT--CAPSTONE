import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE_URL, getToken, setHotelSession } from '../services/apiClient.js';

const PING_MS = 25_000;
const MAX_RETRY_MS = 15_000;

/** Chiusure decise dal server dopo le quali riconnettersi non servirebbe (vedi RoomRegistry). */
const FINAL_CLOSES = {
  4001: 'replaced',
  4003: 'auth_failed',
  4004: 'banned'
};

/**
 * Indirizzo del WebSocket dell'hotel, ricavato da quello delle API: stesso host e stessa
 * sicurezza (wss sotto https). In sviluppo passa dal proxy di Vite.
 */
export function hotelSocketUrl() {
  const api = new URL(BASE_URL, window.location.href);
  const protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${api.host}/ws/hotel`;
}

/**
 * Connessione all'hotel con riconnessione automatica.
 *
 * - Il primo messaggio e' l'autenticazione con il token del login.
 * - Se la rete cade si riprova con attese crescenti (1, 2, 4... fino a 15 secondi); alla
 *   riconnessione `onReconnect` rimanda l'utente nella stanza in cui era.
 * - Un ping ogni 25 secondi tiene viva la connessione dietro a proxy che chiudono quelle mute.
 *
 * I messaggi arrivano a `onMessage` e non passano dallo stato di React: sono tanti e servono
 * soprattutto al motore grafico.
 */
export function useHotelSocket({ onMessage, onReconnect, enabled = true }) {
  const [status, setStatus] = useState(enabled ? 'connecting' : 'idle');
  // "Riprendi qui" dopo che l'hotel e' stato aperto su un altro dispositivo: si riconnette.
  const [attempt, setAttempt] = useState(0);
  const everConnectedRef = useRef(false);
  const socketRef = useRef(null);
  const handlers = useRef({ onMessage, onReconnect });
  useEffect(() => {
    handlers.current = { onMessage, onReconnect };
  }, [onMessage, onReconnect]);

  useEffect(() => {
    // La connessione parte solo quando serve (la prima visita all'hotel), poi resta aperta.
    if (!enabled) return undefined;
    let retryMs = 1_000;
    let retryTimer = 0;
    let pingTimer = 0;
    let stopped = false;

    const connect = () => {
      setStatus('connecting');
      const socket = new WebSocket(hotelSocketUrl());
      socketRef.current = socket;
      // Il server rimanda "hello" anche quando rilegge il profilo (guardaroba, carte vendute):
      // solo il primo di ogni connessione vuol dire "sono di nuovo online".
      let greeted = false;

      socket.onopen = () => {
        // Sito: il token e' nel cookie HttpOnly arrivato con l'handshake. App nativa: nel messaggio.
        const token = getToken();
        socket.send(JSON.stringify(token ? { type: 'auth', token } : { type: 'auth' }));
      };

      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === 'hello' && !greeted) {
          greeted = true;
          retryMs = 1_000;
          setStatus('online');
          if (everConnectedRef.current) handlers.current.onReconnect?.();
          everConnectedRef.current = true;
        }
        if (message.type === 'hello' && message.session) setHotelSession(message.session);
        handlers.current.onMessage?.(message);
      };

      socket.onclose = (event) => {
        clearInterval(pingTimer);
        setHotelSession(null);
        if (stopped) return;
        const final = FINAL_CLOSES[event.code];
        if (final) {
          setStatus(final);
          return;
        }
        setStatus('reconnecting');
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      };

      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, PING_MS);
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, attempt]);

  const resume = useCallback(() => setAttempt((n) => n + 1), []);

  const send = useCallback((message) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  return { status, send, resume };
}
