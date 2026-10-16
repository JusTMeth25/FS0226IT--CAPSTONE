import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotel } from './hotel-context.js';

/**
 * Sfide in tempo reale fuori dall'hotel (pagina Battaglie): usa la connessione dell'hotel
 * (HotelProvider) senza entrare in una stanza e tiene lo stato del pannello PvP, come fa
 * HotelPage per le sfide nelle stanze. `active` accende la connessione: si collega solo chi apre
 * la scheda "Giocatore online".
 */
export function useOnlinePvp({ active, onEnd } = {}) {
  const hotel = useHotel();
  const [pvp, setPvp] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [notice, setNotice] = useState(null);
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; });

  const { activate, subscribe, send, status, takePendingMatch } = hotel;
  useEffect(() => {
    if (active) activate();
  }, [active, activate]);

  useEffect(() => {
    const handle = (message) => {
    switch (message.type) {
      case 'challenge_received':
        setPvp({ stage: 'incoming', challengeId: message.challengeId, from: message.from,
          expiresAt: Date.now() + (message.expiresIn || 20_000) });
        break;
      case 'challenge_sent':
        setPvp({ stage: 'sent', to: message.to });
        break;
      case 'challenge_declined':
        setPvp(null);
        setNotice(`${message.by} ha rifiutato la sfida.`);
        break;
      case 'challenge_expired':
        setPvp((p) => (p && (p.stage === 'incoming' || p.stage === 'sent')
          && (!p.challengeId || p.challengeId === message.challengeId) ? null : p));
        break;
      case 'pvp_start':
        setClockOffset(message.serverTime - Date.now());
        setPvp({ stage: 'team', matchId: message.matchId, opponent: message.opponent, deadline: message.teamDeadline,
          tournament: message.tournament || null });
        break;
      case 'pvp_team_ok':
        setPvp((p) => (p ? { ...p, teamSent: true } : p));
        break;
      case 'pvp_opponent_ready':
        setPvp((p) => (p ? { ...p, opponentReady: true } : p));
        break;
      case 'pvp_round':
        setClockOffset(message.serverTime - Date.now());
        setPvp((p) => ({
          ...p, stage: 'round', round: message.round, chooser: message.chooser, category: null,
          deadline: message.deadline || null, team: message.team, synergies: message.synergies, used: message.used,
          boostUsed: message.boostUsed, score: message.score, picked: false, pickedIndex: null, opponentPicked: false
        }));
        break;
      case 'pvp_category':
        setPvp((p) => (p ? { ...p, stage: 'round', category: message.category, deadline: message.deadline } : p));
        break;
      case 'pvp_card_ok':
        setPvp((p) => (p ? { ...p, picked: true, pickedIndex: message.index } : p));
        break;
      case 'pvp_opponent_picked':
        setPvp((p) => (p ? { ...p, opponentPicked: true } : p));
        break;
      case 'pvp_reveal':
        setPvp((p) => (p ? { ...p, stage: 'reveal', reveal: message, score: message.score, deadline: null } : p));
        break;
      case 'pvp_end':
        setPvp((p) => ({ ...p, stage: 'end', result: message.result, score: message.score, reward: message.reward,
          forfeit: message.forfeit, tiebreak: !!message.tiebreak, tournament: message.tournament || p?.tournament || null, deadline: null }));
        endRef.current?.(message);
        break;
      case 'pvp_cancelled':
        setPvp(null);
        setNotice('Sfida annullata: nessuno ha scelto la squadra in tempo.');
        break;
      case 'error':
        if (['user_offline', 'opponent_busy', 'already_in_match', 'cannot_challenge_yourself', 'challenge_expired'].includes(message.code)) {
          setNotice(ERRORS[message.code]);
        }
        break;
      default:
        break;
    }
    };
    // Partita del torneo partita mentre si era su un'altra pagina (vedi HotelProvider).
    const pending = takePendingMatch?.();
    if (pending) handle(pending);
    return subscribe(handle);
  }, [subscribe, takePendingMatch]);

  const challenge = useCallback((userId) => {
    setNotice(null);
    send({ type: 'challenge_online', userId });
  }, [send]);

  return { pvp, setPvp, clockOffset, notice, setNotice, challenge, send, online: status === 'online', status };
}

const ERRORS = {
  user_offline: 'Il giocatore non è più collegato.',
  opponent_busy: 'Il giocatore sta già giocando una sfida.',
  already_in_match: 'Hai già una sfida in corso.',
  cannot_challenge_yourself: 'Non puoi sfidare te stesso.',
  challenge_expired: 'La sfida è scaduta.'
};
