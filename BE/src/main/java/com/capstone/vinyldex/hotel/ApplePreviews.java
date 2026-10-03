package com.capstone.vinyldex.hotel;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/**
 * Anteprime di Apple Music per i brani messi in coda da Spotify: chi nella stanza non ha Spotify
 * Premium sente almeno i 30 secondi del brano. Il server le cerca su iTunes Search API (gratuita,
 * senza chiave) una alla volta, con una piccola cache, e le aggiunge al brano in coda.
 *
 * Si preferisce sempre la versione originale (esplicita), mai quella censurata.
 */
final class ApplePreviews {

    private ApplePreviews() {
    }

    record Found(String preview, String url, String artwork) {
    }

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private static final JsonMapper JSON = JsonMapper.builder().build();
    /** Una richiesta per volta: iTunes limita a una ventina di ricerche al minuto. */
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "apple-previews");
        thread.setDaemon(true);
        return thread;
    });
    private static final Map<String, Optional<Found>> CACHE = new ConcurrentHashMap<>();

    /** Cerca l'anteprima in sottofondo e la passa a `done` (solo se l'ha trovata). */
    static void lookup(String artist, String title, Consumer<Found> done) {
        String key = (artist + "|" + title).toLowerCase(Locale.ROOT);
        Optional<Found> cached = CACHE.get(key);
        if (cached != null) {
            cached.ifPresent(done);
            return;
        }
        WORKER.submit(() -> {
            Optional<Found> found = CACHE.computeIfAbsent(key, k -> Optional.ofNullable(search(artist, title)));
            found.ifPresent(done);
        });
    }

    private static String base(String title) {
        return title.toLowerCase(Locale.ROOT).split(" \\(")[0].split(" \\[")[0].split(" - ")[0].strip();
    }

    private static Found search(String artist, String title) {
        String firstArtist = artist.split(",")[0].split(" & ")[0].strip();
        String term = URLEncoder.encode(firstArtist + " " + base(title), StandardCharsets.UTF_8);
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(
                            "https://itunes.apple.com/search?entity=song&limit=25&country=it&term=" + term))
                    .timeout(Duration.ofSeconds(8)).GET().build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return null;
            JsonNode best = null;
            int bestScore = Integer.MAX_VALUE;
            for (JsonNode r : JSON.readTree(response.body()).path("results")) {
                String name = r.path("trackName").asString("").toLowerCase(Locale.ROOT);
                String who = r.path("artistName").asString("").toLowerCase(Locale.ROOT);
                if (r.path("previewUrl").asString("").isEmpty() || !who.contains(firstArtist.toLowerCase(Locale.ROOT))
                        || !name.startsWith(base(title))) {
                    continue;
                }
                String explicitness = r.path("trackExplicitness").asString("");
                int score = ("cleaned".equals(explicitness) ? 10 : "explicit".equals(explicitness) ? 0 : 1)
                        + (name.contains("remix") || name.contains("live") || name.contains("instrumental") ? 5 : 0);
                if (score < bestScore) {
                    best = r;
                    bestScore = score;
                }
            }
            if (best == null) return null;
            String url = best.path("trackViewUrl").asString(null);
            String artwork = best.path("artworkUrl100").asString("").replace("100x100", "300x300");
            return new Found(best.path("previewUrl").asString(), url, artwork.isEmpty() ? null : artwork);
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            return null;
        } finally {
            // Pausa fra una ricerca e l'altra, per stare nei limiti di iTunes.
            try {
                Thread.sleep(1_500);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
