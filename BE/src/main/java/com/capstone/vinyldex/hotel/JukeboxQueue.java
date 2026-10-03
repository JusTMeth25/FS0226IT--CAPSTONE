package com.capstone.vinyldex.hotel;

import tools.jackson.databind.JsonNode;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Coda del jukebox nelle stanze dei giocatori: chi e' nella stanza cerca una canzone vera (su
 * Apple Music o, se l'ha collegato, sul suo Spotify) e la mette in coda. Il server tiene la coda
 * e l'ora d'inizio del brano, come la radio della Disco: tutti nella stanza lo sentono a tempo.
 *
 * Ogni brano ha l'anteprima di 30 secondi di Apple Music, che sentono tutti, e se arriva da
 * Spotify anche il suo URI: chi ha Spotify Premium collegato lo sente intero. I brani di Spotify
 * durano quanto il brano vero, gli altri quanto l'anteprima.
 *
 * Oltre alla coda c'e' la radio: una lista lunga di brani (un artista, un album, una ricerca) che
 * suona quando la coda e' vuota. Le canzoni scelte una per una passano sempre davanti.
 */
final class JukeboxQueue {

    /** Indice del jukebox che vuol dire "coda delle canzoni" (i brani sintetizzati sono 0-9, la radio 100). */
    static final int QUEUE_TRACK = 101;
    static final int MAX_QUEUE = 30;
    static final int MAX_PER_USER = 5;
    static final int MAX_STATION = 60;
    /** Anteprima di Apple Music: il brano dopo parte un po' prima della fine, per la dissolvenza. */
    static final long PREVIEW_MILLIS = 27_000;
    private static final long MAX_DURATION_MILLIS = 20 * 60_000;

    private static final Pattern SPOTIFY_URI = Pattern.compile("spotify:track:[A-Za-z0-9]{22}");
    private static final Pattern PREVIEW = Pattern.compile("https://audio-ssl\\.itunes\\.apple\\.com/[\\w./%+-]+\\.m4a");
    private static final Pattern ARTWORK = Pattern.compile("https://(is\\d+-ssl\\.mzstatic\\.com|i\\.scdn\\.co)/[\\w./%+-]+");
    private static final Pattern APPLE_URL = Pattern.compile("https://music\\.apple\\.com/[\\w./%?=&+-]+");

    record Song(String id, String title, String artist, String artwork, String preview, String appleUrl,
                String spotifyUri, long durationMs, UUID addedById, String addedBy) {

        /** Quanto resta in onda: il brano intero se arriva da Spotify, altrimenti l'anteprima. */
        long playMillis() {
            return spotifyUri != null && durationMs > 0 ? durationMs : PREVIEW_MILLIS;
        }

        Map<String, Object> view() {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("id", id);
            view.put("title", title);
            view.put("artist", artist);
            view.put("artwork", artwork);
            view.put("preview", preview);
            view.put("url", appleUrl);
            view.put("spotifyUri", spotifyUri);
            view.put("spotifyUrl", spotifyUri == null ? null
                    : "https://open.spotify.com/track/" + spotifyUri.substring("spotify:track:".length()));
            view.put("durationMs", playMillis());
            view.put("addedBy", addedBy);
            view.put("addedById", addedById);
            return view;
        }
    }

    /** Radio: nome (per esempio "Radio Skrillex"), chi l'ha messa e i brani che restano. */
    record Station(String name, UUID addedById, String addedBy, Deque<Song> songs) {
    }

    private final Deque<Song> queue = new ArrayDeque<>();
    private Station station;
    private Song current;
    private long startedAt;

    Song current() {
        return current;
    }

    long startedAt() {
        return startedAt;
    }

    boolean isEmpty() {
        return current == null && queue.isEmpty() && (station == null || station.songs().isEmpty());
    }

    Station station() {
        return station;
    }

    /** Accende una radio al posto di quella di prima: i brani validi, al massimo MAX_STATION. */
    String setStation(String name, List<Song> songs, UUID userId, String username) {
        List<Song> valid = songs.stream().filter(java.util.Objects::nonNull).limit(MAX_STATION).toList();
        if (valid.isEmpty()) return "jukebox_bad_song";
        station = new Station(clean(name, 60).isEmpty() ? "Radio" : clean(name, 60), userId, username, new ArrayDeque<>(valid));
        return null;
    }

    /** Altri brani per la radio accesa da questa persona (la radio arriva a pezzi). */
    String appendStation(List<Song> songs, UUID userId) {
        if (station == null || !station.addedById().equals(userId)) return null;
        for (Song song : songs) {
            if (song == null) continue;
            if (station.songs().size() >= MAX_STATION) break;
            station.songs().add(song);
        }
        return null;
    }

    void stopStation() {
        station = null;
    }

    /** I brani ancora senza anteprima Apple (arrivati da Spotify), in coda o in radio. */
    List<Song> missingPreviews(int max) {
        List<Song> list = new ArrayList<>();
        if (current != null && current.preview() == null) list.add(current);
        for (Song song : queue) if (song.preview() == null && list.size() < max) list.add(song);
        if (station != null) for (Song song : station.songs()) if (song.preview() == null && list.size() < max) list.add(song);
        return list;
    }

    /** Aggiunge l'anteprima Apple trovata dal server a un brano (dovunque sia). true se l'ha trovato. */
    boolean setPreview(String songId, String preview, String appleUrl, String artwork) {
        java.util.function.UnaryOperator<Song> fill = s -> new Song(s.id(), s.title(), s.artist(),
                s.artwork() != null ? s.artwork() : artwork, preview, s.appleUrl() != null ? s.appleUrl() : appleUrl,
                s.spotifyUri(), s.durationMs(), s.addedById(), s.addedBy());
        if (current != null && current.id().equals(songId)) {
            current = fill.apply(current);
            return true;
        }
        return replaceIn(queue, songId, fill) || (station != null && replaceIn(station.songs(), songId, fill));
    }

    private static boolean replaceIn(Deque<Song> list, String songId, java.util.function.UnaryOperator<Song> fill) {
        List<Song> copy = new ArrayList<>(list);
        for (int i = 0; i < copy.size(); i++) {
            if (copy.get(i).id().equals(songId)) {
                copy.set(i, fill.apply(copy.get(i)));
                list.clear();
                list.addAll(copy);
                return true;
            }
        }
        return false;
    }

    /**
     * Il brano mandato dal client, controllato campo per campo: solo testi brevi e indirizzi di
     * Apple Music e Spotify, cosi' nessuno fa suonare o mostrare altro alla stanza. null se non va.
     */
    static Song parse(JsonNode node, UUID userId, String username) {
        if (node == null || !node.isObject()) return null;
        String title = clean(node.path("title").asString(""), 120);
        String artist = clean(node.path("artist").asString(""), 120);
        String preview = matching(node.path("preview").asString(""), PREVIEW);
        String spotifyUri = matching(node.path("spotifyUri").asString(""), SPOTIFY_URI);
        if (title.isEmpty() || artist.isEmpty() || (preview == null && spotifyUri == null)) return null;
        long duration = node.path("durationMs").asLong(0);
        if (duration < 0 || duration > MAX_DURATION_MILLIS) duration = 0;
        return new Song(UUID.randomUUID().toString(), title, artist, matching(node.path("artwork").asString(""), ARTWORK),
                preview, matching(node.path("url").asString(""), APPLE_URL), spotifyUri, duration, userId, username);
    }

    private static String clean(String value, int max) {
        String text = value.replaceAll("[\\p{Cntrl}]", "").strip();
        return text.length() > max ? text.substring(0, max) : text;
    }

    private static String matching(String value, Pattern pattern) {
        return value.length() <= 500 && pattern.matcher(value).matches() ? value : null;
    }

    /** Mette in coda; null se e' andata bene, altrimenti il codice d'errore per il client. */
    String add(Song song) {
        if (queue.size() >= MAX_QUEUE) return "jukebox_queue_full";
        long mine = queue.stream().filter(s -> s.addedById().equals(song.addedById())).count();
        if (mine >= MAX_PER_USER) return "jukebox_queue_mine";
        queue.add(song);
        return null;
    }

    /** Parte il brano dopo (se c'e'): true se adesso suona qualcosa. */
    boolean advance(long now) {
        current = queue.poll();
        if (current == null && station != null) {
            current = station.songs().poll();
            if (station.songs().isEmpty()) station = null;
        }
        startedAt = now;
        return current != null;
    }

    boolean due(long now) {
        return current != null && now - startedAt >= current.playMillis();
    }

    /** Un brano della coda (non ancora partito), o null. */
    Song find(String id) {
        return queue.stream().filter(s -> s.id().equals(id)).findFirst().orElse(null);
    }

    /** Toglie dalla coda un brano non ancora partito. */
    Song remove(String id) {
        for (Song song : queue) {
            if (song.id().equals(id)) {
                queue.remove(song);
                return song;
            }
        }
        return null;
    }

    void stop() {
        current = null;
    }

    void clear() {
        queue.clear();
        station = null;
        current = null;
    }

    /** Il brano che suonera' dopo: il primo della coda, altrimenti il prossimo della radio. */
    private Song next() {
        Song next = queue.peek();
        return next != null || station == null ? next : station.songs().peek();
    }

    /** Il brano in onda (per la barra del "sta suonando") con l'anteprima del prossimo da caricare. */
    Map<String, Object> nowPlaying() {
        if (current == null) return null;
        Map<String, Object> view = current.view();
        view.put("role", "queue");
        view.put("startedAt", startedAt);
        Song next = next();
        view.put("nextPreview", next == null ? null : next.preview());
        return view;
    }

    List<Map<String, Object>> upcoming() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Song song : queue) list.add(song.view());
        return list;
    }

    /** La radio accesa (nome, chi l'ha messa, i prossimi brani) o null. */
    Map<String, Object> stationView() {
        if (station == null) return null;
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("name", station.name());
        view.put("addedBy", station.addedBy());
        view.put("addedById", station.addedById());
        view.put("left", station.songs().size());
        List<Map<String, Object>> next = new ArrayList<>();
        for (Song song : station.songs()) {
            if (next.size() >= 10) break;
            next.add(song.view());
        }
        view.put("next", next);
        return view;
    }
}
