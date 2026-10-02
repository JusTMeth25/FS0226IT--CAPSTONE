package com.capstone.vinyldex.importer.sources;

import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Immagini delle carte del catalogo TCGplayer.
 *
 * Alcune stampe non hanno una foto (imageCount 0: per esempio "DONE AND DUSTED. (SP) (Silver Stamp)"
 * di Weiss Schwarz): il loro indirizzo risponde 403 e la carta resterebbe senza immagine. Per queste
 * si usa la foto di un'altra stampa della stessa carta nello stesso set (la Gold Stamp, la normale...),
 * scegliendo quella con piu' sigle in comune; se non ce n'e' nessuna, nessuna immagine (il frontend
 * disegna il segnaposto).
 */
final class TcgplayerImages {

    private static final Pattern TAG = Pattern.compile("\\s*\\(([^)]*)\\)");

    private TcgplayerImages() {
    }

    static String url(int productId) {
        return "https://tcgplayer-cdn.tcgplayer.com/product/" + productId + "_in_1000x1000.jpg";
    }

    /** Immagine da usare per ogni prodotto del gruppo (id del prodotto -> indirizzo, "" se nessuna). */
    static Map<Integer, String> forGroup(List<JsonNode> products) {
        Map<String, List<JsonNode>> byName = new HashMap<>();
        for (JsonNode p : products) {
            if (p.get("productId") == null) continue;
            byName.computeIfAbsent(baseName(p), k -> new ArrayList<>()).add(p);
        }
        Map<Integer, String> result = new HashMap<>();
        for (JsonNode p : products) {
            JsonNode id = p.get("productId");
            if (id == null) continue;
            if (hasImage(p)) {
                result.put(id.intValue(), url(id.intValue()));
                continue;
            }
            Set<String> tags = tags(p);
            JsonNode best = null;
            int bestShared = -1;
            for (JsonNode sibling : byName.getOrDefault(baseName(p), List.of())) {
                if (sibling == p || !hasImage(sibling)) continue;
                Set<String> shared = new HashSet<>(tags(sibling));
                shared.retainAll(tags);
                if (shared.size() > bestShared) {
                    bestShared = shared.size();
                    best = sibling;
                }
            }
            result.put(id.intValue(), best == null ? "" : url(best.get("productId").intValue()));
        }
        return result;
    }

    /** Il catalogo dice quante foto ha il prodotto; se non lo dice, si presume che ci siano. */
    static boolean hasImage(JsonNode product) {
        JsonNode count = product.get("imageCount");
        return count == null || count.isNull() || count.asInt() > 0;
    }

    /** "DONE AND DUSTED. (SP) (Silver Stamp)" -> "done and dusted." */
    static String baseName(JsonNode product) {
        JsonNode name = product.get("name");
        String text = name == null || name.isNull() ? "" : name.asString();
        return TAG.matcher(text).replaceAll("").trim().toLowerCase();
    }

    private static Set<String> tags(JsonNode product) {
        Set<String> tags = new HashSet<>();
        JsonNode name = product.get("name");
        Matcher m = TAG.matcher(name == null || name.isNull() ? "" : name.asString());
        while (m.find()) tags.add(m.group(1).trim().toLowerCase());
        return tags;
    }
}
