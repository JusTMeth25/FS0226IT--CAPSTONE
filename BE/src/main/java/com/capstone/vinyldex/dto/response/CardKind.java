package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Card;

import java.util.List;
import java.util.Map;

/**
 * Tipologia di una carta per i bonus di squadra in battaglia (stessa tipologia = sinergia):
 * il tipo di un Pokemon, il colore di una carta Magic, One Piece, Digimon, Lorcana, la razza
 * di un mostro Yu-Gi-Oh!, la squadra NBA, il club FC 27, la serie dei giochi TCGplayer.
 * Le carte VinylDex usano la classe d'artista, che e' un campo a parte: qui null.
 */
public final class CardKind {

    private CardKind() {
    }

    private static final Map<String, String> POKEMON_TYPES = Map.ofEntries(
            Map.entry("Fire", "Fuoco"), Map.entry("Water", "Acqua"), Map.entry("Grass", "Erba"),
            Map.entry("Lightning", "Elettro"), Map.entry("Psychic", "Psico"), Map.entry("Fighting", "Lotta"),
            Map.entry("Darkness", "Oscurita'"), Map.entry("Metal", "Metallo"), Map.entry("Dragon", "Drago"),
            Map.entry("Fairy", "Folletto"), Map.entry("Colorless", "Incolore"));

    private static final Map<String, String> MAGIC_COLORS = Map.of(
            "W", "Bianco", "U", "Blu", "B", "Nero", "R", "Rosso", "G", "Verde");

    public static String of(Card card) {
        Map<String, Object> m = card.getMetadata();
        String source = card.getSource() == null ? "" : card.getSource();
        if (m == null || "original".equals(source)) return null;
        return switch (source) {
            case "pokemon" -> {
                String type = first(m.get("types"));
                yield type == null ? null : POKEMON_TYPES.getOrDefault(type, type);
            }
            case "scryfall" -> {
                Object colors = m.get("colors");
                if (!(colors instanceof List<?> list)) yield null;
                if (list.isEmpty()) yield "Incolore";
                if (list.size() > 1) yield "Multicolore";
                yield MAGIC_COLORS.getOrDefault(String.valueOf(list.get(0)), String.valueOf(list.get(0)));
            }
            case "yugioh" -> text(m.get("race"));
            case "onepiece", "digimon", "dragonball", "gundam", "lorcana" -> text(m.get("color"));
            case "riftbound" -> first(m.get("domain"));
            case "nba" -> text(m.get("team"));
            case "fc27" -> text(m.get("club"));
            default -> {
                // Giochi del catalogo TCGplayer (cyberpunk, hololive, Union Arena, NIKKE, Pokemon JP...):
                // la serie, altrimenti il tipo di carta.
                String series = text(m.get("series"));
                yield series != null ? series : text(m.get("cardType"));
            }
        };
    }

    private static String first(Object value) {
        if (value instanceof List<?> list && !list.isEmpty()) return text(list.get(0));
        return text(value);
    }

    private static String text(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        // Colori doppi ("Red/Green", "Red;Blue"): conta il primo.
        int cut = s.indexOf('/');
        if (cut < 0) cut = s.indexOf(';');
        if (cut > 0) s = s.substring(0, cut).trim();
        return s.isEmpty() || "None".equalsIgnoreCase(s) ? null : s;
    }
}
