package com.capstone.vinyldex.hotel;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gara dei go-kart fra giocatori. Chi sale su un kart apre la griglia: per qualche secondo chi
 * sale su un altro kart entra nella stessa gara, poi il semaforo si spegne per tutti alla stessa
 * ora. Arrivati tutti (o ritirati), la classifica va a tutta la stanza. Chi arriva a gara gia'
 * partita corre da solo, a cronometro.
 */
final class KartRace {

    static final long GATHER_MILLIS = 7_000;
    static final long SOLO_START_MILLIS = 3_000;
    /** Oltre questo tempo dal via la gara si chiude comunque (qualcuno si e' distratto). */
    static final long MAX_MILLIS = 200_000;

    /** Piazzamento: tempo in punti (piu' alto = piu' veloce), -1 se ritirato. */
    record Placing(UUID id, String name, int score) {
    }

    private long startsAt;
    private final Map<UUID, String> racers = new LinkedHashMap<>();
    private final Map<UUID, Integer> results = new LinkedHashMap<>();
    private boolean closed = true;

    /** Ora del via per chi sale adesso sul kart (e se e' in gara con gli altri). */
    long join(UUID id, String name, long now) {
        boolean running = !closed && now >= startsAt;
        if (running) return now + SOLO_START_MILLIS;
        if (closed) {
            racers.clear();
            results.clear();
            startsAt = now + GATHER_MILLIS;
            closed = false;
        }
        racers.put(id, name);
        results.remove(id);
        return startsAt;
    }

    boolean isRacer(UUID id) {
        return !closed && racers.containsKey(id);
    }

    void finish(UUID id, int score) {
        if (isRacer(id)) results.putIfAbsent(id, Math.max(0, score));
    }

    /** Uscito dal kart prima del traguardo: ritirato. */
    void leave(UUID id) {
        if (isRacer(id)) results.putIfAbsent(id, -1);
    }

    /**
     * Classifica, se la gara e' finita adesso (tutti arrivati o ritirati, o troppo tempo dal via).
     * Una gara con un solo pilota si chiude senza classifica.
     */
    List<Placing> ended(long now) {
        if (closed || racers.isEmpty()) return null;
        boolean allDone = results.keySet().containsAll(racers.keySet());
        if (!allDone && now < startsAt + MAX_MILLIS) return null;
        closed = true;
        if (racers.size() < 2) return List.of();
        List<Placing> ranking = new ArrayList<>();
        racers.forEach((id, name) -> ranking.add(new Placing(id, name, results.getOrDefault(id, -1))));
        ranking.sort(Comparator.comparingInt(Placing::score).reversed());
        return ranking;
    }

    Map<String, Object> view() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("type", "kart_race");
        view.put("startsAt", startsAt);
        view.put("racers", racers.entrySet().stream().map(e -> Map.of("id", e.getKey(), "name", e.getValue())).toList());
        return view;
    }
}
