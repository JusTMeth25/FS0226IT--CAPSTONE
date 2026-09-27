import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient.js';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';

const ERRORS = {
  quest_already_done: 'Incarico gia\' consegnato oggi.',
  quest_wrong_card: 'Quella carta non va bene per questo incarico.',
  card_not_owned: 'Non hai piu\' quella carta.'
};

/**
 * Incarichi degli NPC: tre richieste al giorno, uguali per tutti. Si sceglie una propria carta che
 * va bene e la si consegna: gold subito e, per la richiesta epica, la Teca 3D nella borsa.
 */
export default function QuestsTab({ onDone, onGoToRoom }) {
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  // Per ogni incarico: solo doppioni e ricerca per nome fra le carte adatte.
  const [onlySpares, setOnlySpares] = useState({});
  const [query, setQuery] = useState({});

  const load = useCallback(() => {
    apiClient.get('/hotel/quests').then(setData).catch(() => setNotice('Incarichi non disponibili, riprova.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const deliver = (quest) => {
    const card = picked[quest.index];
    if (!card) return;
    const chosen = quest.candidates.find((c) => c.card.id === card);
    if (chosen?.quantity === 1 && !window.confirm(`${chosen.card.name} è la tua unica copia: consegnandola non l'avrai più. Continuare?`)) return;
    setBusy(true);
    apiClient.post(`/hotel/quests/${quest.index}`, { card })
      .then((res) => {
        setNotice(`${res.npcName}: grazie! +${res.earned} gold${res.furni ? ' e una Teca 3D nella borsa!' : ''}`);
        onDone?.();
        load();
      })
      .catch((err) => setNotice(ERRORS[err?.code] || 'Consegna non riuscita.'))
      .finally(() => setBusy(false));
  };

  if (!data) return <p className="hotel-panel-hint">{notice || 'Carico gli incarichi…'}</p>;
  return (
    <div className="quests-tab">
      <p className="hotel-panel-hint">Ogni giorno tre personaggi dell&apos;hotel cercano una carta. Portagliela e vieni ricompensato.</p>
      {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}
      <ol className="quest-list">
        {data.quests.map((q) => (
          <li key={q.index} className={`quest${q.done ? ' done' : ''}`}>
            <div className="quest-head">
              <strong><i className="ph-fill ph-user-sound" /> {q.npcName}</strong>
              <button type="button" className="quest-room" onClick={() => onGoToRoom?.(q.roomId)} title="Vai nella sua stanza">
                <i className="ph-fill ph-map-pin" /> {q.roomName}
              </button>
            </div>
            <p className="quest-text">&ldquo;{q.text}&rdquo;</p>
            <p className="quest-reward"><i className="ph-fill ph-coin" /> {q.gold} gold{q.furni && <> + <i className="ph-fill ph-cube-transparent" /> Teca 3D</>}</p>
            <p className="quest-requirement"><i className="ph-fill ph-info" /> {q.requirement}</p>
            {!q.done && q.fitting > 0 && (
              <p className="quest-count">
                Ne hai <strong>{q.fitting}</strong> che vanno bene, di cui <strong>{q.spares}</strong> con doppioni
                {q.spares > 0 ? ' (consegnane uno: la carta resta nella tua collezione).' : ': consegnandone una la perdi.'}
              </p>
            )}
            {q.done ? <span className="quest-done"><i className="ph-fill ph-check-circle" /> Consegnato</span> : q.candidates.length === 0 ? (
              <span className="quest-none">Non hai ancora una carta adatta.</span>
            ) : (
              <>
                <div className="quest-filters">
                  <input type="search" value={query[q.index] || ''} placeholder="Cerca fra le carte adatte…" aria-label="Cerca carta"
                    onChange={(e) => setQuery((f) => ({ ...f, [q.index]: e.target.value }))} />
                  {q.spares > 0 && (
                    <label>
                      <input type="checkbox" checked={!!onlySpares[q.index]} onChange={(e) => setOnlySpares((f) => ({ ...f, [q.index]: e.target.checked }))} />
                      Solo doppioni
                    </label>
                  )}
                </div>
                <div className="quest-cards">
                  {q.candidates
                    .filter(({ card, quantity }) => (!onlySpares[q.index] || quantity > 1)
                      && (!query[q.index] || card.name.toLowerCase().includes(query[q.index].trim().toLowerCase())))
                    .map(({ card, quantity }) => (
                      <button key={card.id} type="button" className={`quest-card${picked[q.index] === card.id ? ' picked' : ''}${quantity > 1 ? ' spare' : ''}`}
                        style={{ '--rarity-color': getRarityColor(card.rarity) }} title={`${card.name} — ne hai ${quantity}`}
                        onClick={() => setPicked((p) => ({ ...p, [q.index]: card.id }))} aria-pressed={picked[q.index] === card.id}>
                        <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
                        <span className={`quest-card-qty${quantity > 1 ? ' spare' : ''}`}>×{quantity}</span>
                      </button>
                    ))}
                </div>
                <button type="button" className="btn btn-gold btn-small" disabled={busy || !picked[q.index]} onClick={() => deliver(q)}>
                  <i className="ph-fill ph-hand-coins" /> Consegna
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
