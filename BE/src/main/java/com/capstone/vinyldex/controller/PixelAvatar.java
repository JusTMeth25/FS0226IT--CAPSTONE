package com.capstone.vinyldex.controller;

import java.util.Locale;
import java.util.Map;

/**
 * Ritratto a pixel in stile Habbo per le carte EA FC 27 senza foto (le icone che EA non pubblica).
 *
 * Mezzobusto frontale su una griglia 24x24: testa grande, contorno scuro, maglia con i colori
 * della nazionale. L'aspetto (pelle, capelli, barba) viene da metadata.look, scritto a mano per le
 * icone in scripts/fc27_cards.py; senza look si ricava dal nome, sempre uguale per lo stesso giocatore.
 *
 * Esce un frammento SVG (un &lt;svg&gt; annidato) da mettere nel riquadro della foto.
 */
final class PixelAvatar {

    static final int SIZE = 24;

    private static final String OUTLINE = "#1a1410";
    private static final String EYE_WHITE = "#ffffff";
    private static final String MOUTH = "#7a2e22";

    /** Carnagioni: colore base e ombra. */
    private static final Map<String, String[]> SKINS = Map.of(
            "light", new String[]{"#f3d2b3", "#d9a882"},
            "tan", new String[]{"#e0b088", "#c08a60"},
            "medium", new String[]{"#c68a5a", "#a06a40"},
            "brown", new String[]{"#9a6440", "#7a4a2c"},
            "dark", new String[]{"#6b4228", "#50301c"});
    private static final String[] SKIN_ORDER = {"light", "tan", "medium", "brown", "dark"};

    private static final Map<String, String> HAIR_COLORS = Map.of(
            "black", "#1c1714",
            "darkbrown", "#3b2a1a",
            "brown", "#6b4a2b",
            "lightbrown", "#8f6a3f",
            "blond", "#d9b45a",
            "grey", "#9a9a9a");
    private static final String[] HAIR_ORDER = {"black", "darkbrown", "brown", "lightbrown", "blond"};

    /** Maglia della nazionale: colore principale e colletto. */
    private static final Map<String, String[]> KITS = Map.ofEntries(
            Map.entry("brazil", new String[]{"#f7d417", "#1f8a3a"}),
            Map.entry("argentina", new String[]{"#8fd3f4", "#ffffff"}),
            Map.entry("germany", new String[]{"#f5f5f5", "#1c1c1c"}),
            Map.entry("france", new String[]{"#1f3c88", "#ffffff"}),
            Map.entry("italy", new String[]{"#1f5fbf", "#ffffff"}),
            Map.entry("spain", new String[]{"#c8102e", "#f7d417"}),
            Map.entry("england", new String[]{"#f5f5f5", "#1d2a5c"}),
            Map.entry("netherlands", new String[]{"#f57c00", "#1c1c1c"}),
            Map.entry("portugal", new String[]{"#b0152a", "#1f7a3a"}),
            Map.entry("united states", new String[]{"#f5f5f5", "#1d2a5c"}),
            Map.entry("sweden", new String[]{"#f7d417", "#1f5fbf"}),
            Map.entry("hungary", new String[]{"#c8102e", "#ffffff"}),
            Map.entry("denmark", new String[]{"#c8102e", "#ffffff"}),
            Map.entry("belgium", new String[]{"#c8102e", "#1c1c1c"}),
            Map.entry("norway", new String[]{"#c8102e", "#1d2a5c"}));
    private static final String[][] FALLBACK_KITS = {
            {"#2563eb", "#ffffff"}, {"#dc2626", "#ffffff"}, {"#16a34a", "#ffffff"}, {"#111827", "#e5e7eb"}};

    private final String[][] grid = new String[SIZE][SIZE];

    private PixelAvatar() {
    }

    /** Il ritratto come &lt;svg&gt; annidato, posizionato in (x, y) con lato size. */
    static String svg(String name, Map<String, Object> meta, int x, int y, int size) {
        Map<String, Object> m = meta == null ? Map.of() : meta;
        Look look = Look.of(name, m.get("look"));
        String[] kit = kitOf(String.valueOf(m.getOrDefault("nation", "")), name);
        PixelAvatar avatar = new PixelAvatar();
        avatar.paint(look, kit);
        return avatar.toSvg(x, y, size);
    }

    /** Aspetto del giocatore; i campi mancanti si ricavano dal nome. */
    record Look(String skin, String hair, String hairColor, String beard) {

        @SuppressWarnings("unchecked")
        static Look of(String name, Object raw) {
            Map<String, Object> look = raw instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
            int hash = Math.abs((name == null ? "" : name).hashCode());
            String skin = text(look, "skin", SKIN_ORDER[hash % SKIN_ORDER.length]);
            String hair = text(look, "hair", (hash / 7) % 3 == 0 ? "buzz" : "short");
            String hairColor = text(look, "hairColor", HAIR_ORDER[(hash / 11) % HAIR_ORDER.length]);
            String beard = text(look, "beard", "none");
            return new Look(SKINS.containsKey(skin) ? skin : "light", hair, hairColor, beard);
        }

        private static String text(Map<String, Object> look, String key, String fallback) {
            Object value = look.get(key);
            return value instanceof String s && !s.isBlank() ? s.toLowerCase(Locale.ROOT) : fallback;
        }
    }

    static String[] kitOf(String nation, String name) {
        String[] kit = KITS.get(nation.toLowerCase(Locale.ROOT).trim());
        if (kit != null) return kit;
        return FALLBACK_KITS[Math.abs((name == null ? "" : name).hashCode()) % FALLBACK_KITS.length];
    }

    // ------------------------------------------------------------------ disegno

    private void paint(Look look, String[] kit) {
        String[] skin = SKINS.get(look.skin());
        String hair = HAIR_COLORS.getOrDefault(look.hairColor(), look.hairColor().startsWith("#") ? look.hairColor() : HAIR_COLORS.get("black"));

        // Capelli dietro la testa (lunghi, a caschetto, ricci).
        switch (look.hair()) {
            case "long" -> fill(5, 5, 18, 18, hair);
            case "afro", "curly" -> {
                fill(1, 6, 10, 17, hair);
                fill(2, 5, 8, 18, hair);
            }
            case "mullet" -> fill(11, 6, 16, 17, hair);
            default -> { }
        }

        // Maglia, collo e testa.
        fill(19, 4, 23, 19, kit[0]);
        fill(18, 5, 18, 18, kit[0]);
        fill(17, 7, 17, 16, kit[0]);
        fill(17, 10, 17, 13, kit[1]);
        fill(18, 11, 18, 12, kit[1]);
        fill(15, 10, 16, 13, skin[1]);
        fill(5, 7, 13, 16, skin[0]);
        fill(14, 8, 14, 15, skin[0]);
        fill(15, 9, 15, 14, skin[0]);
        set(5, 7, null);
        set(5, 16, null);
        fill(9, 6, 11, 6, skin[0]);
        fill(9, 17, 11, 17, skin[0]);
        set(10, 6, skin[1]);
        set(10, 17, skin[1]);
        // Ombra sotto il mento e sulle guance.
        fill(14, 8, 14, 8, skin[1]);
        fill(14, 15, 14, 15, skin[1]);

        // Viso: sopracciglia, occhi, naso, bocca.
        String brows = "grey".equals(look.hairColor()) ? HAIR_COLORS.get("grey") : darker(hair);
        fill(8, 9, 8, 10, brows);
        fill(8, 13, 8, 14, brows);
        fill(10, 9, 10, 10, EYE_WHITE);
        fill(10, 13, 10, 14, EYE_WHITE);
        set(10, 10, OUTLINE);
        set(10, 13, OUTLINE);
        fill(12, 11, 12, 12, skin[1]);
        fill(13, 10, 13, 13, MOUTH);

        // Barba sopra il viso.
        switch (look.beard()) {
            case "beard" -> {
                fill(12, 7, 14, 8, hair);
                fill(12, 15, 14, 16, hair);
                fill(14, 8, 15, 15, hair);
                fill(12, 10, 12, 13, hair);
                fill(13, 10, 13, 13, MOUTH);
            }
            case "goatee" -> {
                fill(12, 10, 12, 13, hair);
                fill(14, 10, 15, 13, hair);
            }
            case "moustache" -> fill(12, 10, 12, 13, hair);
            case "stubble" -> {
                fill(14, 8, 14, 15, skin[1]);
                fill(15, 9, 15, 14, skin[1]);
                fill(12, 10, 12, 13, skin[1]);
            }
            default -> { }
        }

        // Capelli sopra la testa.
        switch (look.hair()) {
            case "short", "mullet" -> {
                fill(3, 8, 3, 15, hair);
                fill(4, 7, 6, 16, hair);
                fill(7, 7, 8, 7, hair);
                fill(7, 16, 8, 16, hair);
            }
            case "buzz" -> {
                fill(4, 8, 4, 15, hair);
                fill(5, 7, 5, 16, hair);
            }
            case "long" -> {
                fill(3, 8, 3, 15, hair);
                fill(4, 6, 6, 17, hair);
                fill(7, 6, 13, 7, hair);
                fill(7, 16, 13, 17, hair);
            }
            case "ponytail" -> {
                fill(3, 8, 3, 15, hair);
                fill(4, 7, 6, 16, hair);
                fill(7, 7, 8, 7, hair);
                fill(7, 16, 8, 16, hair);
                fill(6, 18, 12, 19, hair);
            }
            case "bun" -> {
                fill(1, 10, 2, 13, hair);
                fill(3, 8, 3, 15, hair);
                fill(4, 7, 6, 16, hair);
                fill(7, 7, 9, 7, hair);
                fill(7, 16, 9, 16, hair);
            }
            case "afro", "curly" -> {
                fill(3, 7, 6, 16, hair);
                fill(7, 6, 9, 7, hair);
                fill(7, 16, 9, 17, hair);
                // Bordo mosso dei ricci.
                for (int c = 6; c <= 17; c += 2) set(1, c, null);
            }
            case "receding" -> {
                fill(4, 10, 4, 13, hair);
                fill(5, 7, 9, 7, hair);
                fill(5, 16, 9, 16, hair);
                fill(5, 8, 5, 8, hair);
                fill(5, 15, 5, 15, hair);
            }
            case "bald" -> {
                fill(8, 7, 10, 7, hair);
                fill(8, 16, 10, 16, hair);
            }
            default -> { }
        }

        outline();
    }

    /** Contorno scuro attorno a tutto, come gli sprite di Habbo. */
    private void outline() {
        boolean[][] edge = new boolean[SIZE][SIZE];
        for (int r = 0; r < SIZE; r++) {
            for (int c = 0; c < SIZE; c++) {
                if (grid[r][c] != null) continue;
                edge[r][c] = filled(r - 1, c) || filled(r + 1, c) || filled(r, c - 1) || filled(r, c + 1);
            }
        }
        for (int r = 0; r < SIZE; r++) {
            for (int c = 0; c < SIZE; c++) {
                if (edge[r][c]) grid[r][c] = OUTLINE;
            }
        }
    }

    private boolean filled(int r, int c) {
        return r >= 0 && c >= 0 && r < SIZE && c < SIZE && grid[r][c] != null && !OUTLINE.equals(grid[r][c]);
    }

    private void fill(int r1, int c1, int r2, int c2, String color) {
        for (int r = r1; r <= r2; r++) {
            for (int c = c1; c <= c2; c++) set(r, c, color);
        }
    }

    private void set(int r, int c, String color) {
        if (r >= 0 && c >= 0 && r < SIZE && c < SIZE) grid[r][c] = color;
    }

    /** Righe di pixel dello stesso colore unite in un solo rettangolo: SVG piu' leggero. */
    private String toSvg(int x, int y, int size) {
        StringBuilder s = new StringBuilder();
        s.append("<svg x='").append(x).append("' y='").append(y).append("' width='").append(size)
                .append("' height='").append(size).append("' viewBox='0 0 ").append(SIZE).append(' ').append(SIZE)
                .append("' shape-rendering='crispEdges'>");
        for (int r = 0; r < SIZE; r++) {
            int c = 0;
            while (c < SIZE) {
                String color = grid[r][c];
                if (color == null) {
                    c++;
                    continue;
                }
                int start = c;
                while (c < SIZE && color.equals(grid[r][c])) c++;
                s.append("<rect x='").append(start).append("' y='").append(r).append("' width='").append(c - start)
                        .append("' height='1' fill='").append(color).append("'/>");
            }
        }
        s.append("</svg>");
        return s.toString();
    }

    private static String darker(String hex) {
        if (hex == null || !hex.matches("#[0-9a-fA-F]{6}")) return OUTLINE;
        int rgb = Integer.parseInt(hex.substring(1), 16);
        int r = (int) (((rgb >> 16) & 0xff) * 0.7);
        int g = (int) (((rgb >> 8) & 0xff) * 0.7);
        int b = (int) ((rgb & 0xff) * 0.7);
        return String.format("#%02x%02x%02x", r, g, b);
    }
}
