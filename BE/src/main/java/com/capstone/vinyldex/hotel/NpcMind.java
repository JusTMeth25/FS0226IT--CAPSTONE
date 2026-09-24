package com.capstone.vinyldex.hotel;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * La "testa" degli NPC: chi risponde ai giocatori quando si rivolgono a un personaggio.
 *
 * L'implementazione vera (OpenRouterNpcMind) chiede la risposta a un modello linguistico; se non
 * e' disponibile (niente chiave, limite giornaliero finito, modello lento o in errore) restituisce
 * false e la stanza usa le battute scritte a mano di NpcDialog, come prima.
 */
public interface NpcMind {

    /** Nessun modello: gli NPC rispondono sempre con le battute a parole chiave. */
    NpcMind NONE = (prompt, onReply) -> false;

    /**
     * Chiede una risposta. Non blocca: la risposta arriva dopo, su un altro thread, a onReply;
     * se il modello fallisce (errore, limite, risposta illeggibile) onReply riceve null.
     *
     * @return false se la richiesta non e' partita, e allora bisogna rispondere in un altro modo
     */
    boolean ask(Prompt prompt, Consumer<Reply> onReply);

    /** Un messaggio della conversazione fra un NPC e un giocatore. */
    record Line(boolean fromNpc, String text) {
    }

    /**
     * Tutto quello che il modello deve sapere: chi e' l'NPC, dove si trova, con chi parla,
     * cosa sa fare e cosa si sono gia' detti.
     */
    record Prompt(UUID npcId, UUID userId, String npcName, NpcRoster.Role role, String roomName,
                  String roomDescription, List<String> menu, String userName, String userHandItem,
                  List<String> presentNames, boolean musicOn, List<Line> history, String message) {
    }

    /**
     * Risposta gia' controllata: testo breve e un'azione fra quelle permesse (null se nessuna).
     * Le azioni possibili sono "serve:<oggetto del menu>", "dance" e "music".
     */
    record Reply(String text, String action) {
    }
}
