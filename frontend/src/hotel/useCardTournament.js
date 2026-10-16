import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotel } from './hotel-context.js';

const OUT_AT = { 'Ottavi di finale': 'agli ottavi', 'Quarti di finale': 'ai quarti', Semifinali: 'in semifinale', Finale: 'in finale' };

const ERRORS = {
  tournament_running: 'Il torneo è già cominciato: aspetta il prossimo.',
  tournament_full: 'Il tabellone è pieno: aspetta il prossimo torneo.',
  tournament_need_cards: 'Ti servono almeno 3 carte per iscriverti.',
  already_in_match: 'Finisci prima la sfida in corso.',
  in_tournament: 'Sei in gara nel torneo: niente altre sfide finché non finisce.',
  not_in_tournament: 'Non sei iscritto al torneo.'
};

/**
 * Torneo di carte (CardTournamentService) sulla connessione dell'hotel: tabellone sempre
 * aggiornato, iscrizione e ritiro. Le partite arrivano come le altre sfide (pvp_start...): le
 * gestisce chi mostra la partita (HotelPage o la pagina Battaglie).
 */
export function useCardTournament({ active = true, onPrize } = {}) {
  const { activate, subscribe, send, status } = useHotel();
  const [state, setState] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [notice, setNotice] = useState(null);
  const online = status === 'online';
  const prizeRef = useRef(onPrize);
  useEffect(() => { prizeRef.current = onPrize; });

  useEffect(() => {
    if (active) activate();
  }, [active, activate]);

  useEffect(() => subscribe((message) => {
    switch (message.type) {
      case 'tournament_state':
        setClockOffset(message.serverTime - Date.now());
        setState(message);
        break;
      case 'tournament_out':
        setNotice(`Eliminato ${OUT_AT[message.round] || ''}. Ci vediamo al prossimo torneo!`);
        break;
      case 'tournament_prize':
        prizeRef.current?.(message);
        setNotice(message.capped
          ? `Torneo chiuso al ${message.place}° posto! Premi di oggi già presi: niente gold questa volta.`
          : message.place === 1
            ? `Hai vinto il torneo! +${message.gold} gold`
            : `Torneo chiuso al ${message.place}° posto: +${message.gold} gold`);
        break;
      case 'error':
        if (ERRORS[message.code]) setNotice(ERRORS[message.code]);
        break;
      default:
        break;
    }
  }), [subscribe]);

  // Si guarda il tabellone finche' il componente e' aperto (e di nuovo dopo una riconnessione).
  useEffect(() => {
    if (!active || !online) return undefined;
    send({ type: 'tournament_watch' });
    return () => send({ type: 'tournament_unwatch' });
  }, [active, online, send]);

  const join = useCallback(() => {
    setNotice(null);
    send({ type: 'tournament_join' });
  }, [send]);
  const leave = useCallback(() => send({ type: 'tournament_leave' }), [send]);

  return { state, clockOffset, notice, setNotice, join, leave, online };
}
