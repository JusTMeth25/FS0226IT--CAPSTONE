package com.capstone.vinyldex.hotel;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;

/**
 * Limiti della chat di un singolo utente.
 *
 * - Massimo 100 caratteri: e' una chat a fumetti, i messaggi lunghi coprirebbero la stanza.
 * - Massimo 5 messaggi ogni 5 secondi. Chi supera il limite resta muto per 30 secondi.
 * - Caratteri di controllo e spazi multipli ripuliti: niente messaggi vuoti o a capo che
 *   rompono i fumetti.
 *
 * Non e' thread-safe da sola: ogni istanza appartiene a una sessione, e i messaggi di una
 * sessione WebSocket arrivano uno alla volta.
 */
public class ChatFilter {

    public static final int MAX_LENGTH = 100;
    static final int WINDOW_MESSAGES = 5;
    static final long WINDOW_MILLIS = 5_000;
    static final long MUTE_MILLIS = 30_000;

    public enum Verdict { OK, EMPTY, FLOOD, MUTED }

    public record Result(Verdict verdict, String text) {
    }

    private final Clock clock;
    private final Deque<Long> recent = new ArrayDeque<>();
    private long mutedUntil = 0;

    public ChatFilter() {
        this(Clock.systemUTC());
    }

    ChatFilter(Clock clock) {
        this.clock = clock;
    }

    public Result check(String raw) {
        long now = clock.millis();
        if (now < mutedUntil) return new Result(Verdict.MUTED, null);

        String text = clean(raw);
        if (text.isEmpty()) return new Result(Verdict.EMPTY, null);

        while (!recent.isEmpty() && now - recent.peekFirst() > WINDOW_MILLIS) recent.pollFirst();
        if (recent.size() >= WINDOW_MESSAGES) {
            mutedUntil = now + MUTE_MILLIS;
            recent.clear();
            return new Result(Verdict.FLOOD, null);
        }

        recent.addLast(now);
        return new Result(Verdict.OK, text);
    }

    static String clean(String raw) {
        String text = strip(raw);
        return text.length() > MAX_LENGTH ? text.substring(0, MAX_LENGTH) : text;
    }

    /** Toglie caratteri di controllo e spazi multipli, senza tagliare la lunghezza. */
    static String strip(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("[\\p{Cntrl}\\p{Cf}]", " ").replaceAll("\\s+", " ").strip();
    }
}
