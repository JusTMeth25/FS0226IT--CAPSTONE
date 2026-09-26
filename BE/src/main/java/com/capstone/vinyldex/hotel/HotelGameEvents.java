package com.capstone.vinyldex.hotel;

import java.util.UUID;

/**
 * Fatti di gioco successi in una stanza, pubblicati come eventi Spring dal RoomRegistry: le
 * missioni, gli eventi a orario e la classifica del calcio li ascoltano senza che la stanza
 * debba conoscerli. Riguardano solo i giocatori veri, mai gli NPC.
 */
public final class HotelGameEvents {

    private HotelGameEvents() {
    }

    /** Partita finita a un minigioco, con il punteggio accettato dal server. */
    public record MinigamePlayed(UUID roomId, UUID userId, String username, String game, int score) {
    }

    /** Partita a squadre finita allo stadio: chi ha vinto, chi ha perso, o pareggio. */
    public record MatchPlayed(UUID roomId, java.util.List<UUID> winners, java.util.List<UUID> losers, boolean draw) {
    }

    /** Gara dei go-kart finita: piloti arrivati, dal primo all'ultimo. */
    public record KartRaceFinished(UUID roomId, java.util.List<UUID> order) {
    }

    /** Gol segnato allo stadio (anche nelle partite fra giocatori). */
    public record GoalScored(UUID roomId, UUID userId, String username, String team) {
    }
}
