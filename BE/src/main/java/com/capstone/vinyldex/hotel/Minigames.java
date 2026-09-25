package com.capstone.vinyldex.hotel;

import java.util.Map;
import java.util.Optional;

/**
 * Minigiochi sui mobili: la panca, il tapis roulant e il sacco della palestra, la pesca-peluche,
 * il cabinato arcade e il biliardo della sala giochi.
 *
 * Il gioco si svolge nel browser (tasti premuti, tempismo); il server fa partire la partita solo
 * a chi e' davvero accanto al mobile, un giocatore alla volta, e alla fine controlla che il
 * punteggio sia credibile: non oltre il massimo e non prima del tempo minimo. Tiene anche il
 * record della stanza e lo annuncia a tutti.
 */
public final class Minigames {

    /**
     * @param key        nome del gioco, lo stesso del frontend (src/hotel/ui/Minigame.jsx)
     * @param unit       come si chiamano i punti ("ripetizioni", "metri"...)
     * @param maxScore   punteggio massimo possibile: oltre, il risultato viene tagliato
     * @param minMillis  durata minima di una partita vera: prima, il risultato non vale
     * @param maxMillis  oltre questa durata la partita e' abbandonata e il mobile si libera
     * @param onItem     si gioca sopra il mobile (panca, tapis roulant) invece che accanto
     */
    public record Game(String key, String title, String unit, int maxScore, long minMillis, long maxMillis, boolean onItem) {
    }

    private static final Map<String, Game> BY_FURNI = Map.of(
            "weight_bench", new Game("bench", "Panca piana", "ripetizioni", 30, 5_000, 90_000, true),
            "treadmill", new Game("run", "Tapis roulant", "metri", 200, 10_000, 90_000, true),
            "punching_bag", new Game("box", "Sacco da boxe", "colpi", 80, 10_000, 90_000, false),
            "claw_machine", new Game("claw", "Pesca-peluche", "peluche", 3, 3_000, 90_000, false),
            "arcade", new Game("rhythm", "Vinyl Rush", "note", 60, 10_000, 90_000, false),
            "pool_table", new Game("pool", "Biliardo", "buche", 7, 4_000, 120_000, false));

    /** Esito di una partita: un errore, oppure il punteggio accettato e se e' un nuovo record. */
    public record Outcome(String error, Game game, int score, boolean record) {

        static Outcome failed(String error) {
            return new Outcome(error, null, 0, false);
        }
    }

    /** Miglior punteggio della stanza per un gioco. */
    public record Best(String username, int score) {
    }

    private Minigames() {
    }

    public static Optional<Game> forFurni(String type) {
        return Optional.ofNullable(type == null ? null : BY_FURNI.get(type));
    }

    /**
     * Punteggio accettato: tagliato al massimo del gioco, oppure -1 se la partita e' durata
     * meno del minimo (un client modificato che manda subito un punteggio alto).
     */
    public static int validScore(Game game, int score, long elapsedMillis) {
        if (elapsedMillis < game.minMillis()) return -1;
        return Math.max(0, Math.min(game.maxScore(), score));
    }
}
