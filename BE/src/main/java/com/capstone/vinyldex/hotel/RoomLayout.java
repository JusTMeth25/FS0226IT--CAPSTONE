package com.capstone.vinyldex.hotel;

/**
 * Mappa delle altezze di una stanza, letta dalla colonna rooms.layout.
 *
 * Una riga per ogni y; in ogni riga un carattere per ogni x: "x" e' vuoto, una cifra e'
 * una casella camminabile a quell'altezza. Le righe piu' corte valgono come vuote in fondo.
 */
public final class RoomLayout {

    private static final int VOID = -1;

    private final int width;
    private final int height;
    private final int[][] heights;

    private RoomLayout(int[][] heights, int width, int height) {
        this.heights = heights;
        this.width = width;
        this.height = height;
    }

    public static RoomLayout parse(String layout) {
        String[] rows = layout.replace("\r", "").split("\n");
        int width = 0;
        for (String row : rows) width = Math.max(width, row.length());

        int[][] heights = new int[rows.length][width];
        for (int y = 0; y < rows.length; y++) {
            for (int x = 0; x < width; x++) {
                char c = x < rows[y].length() ? rows[y].charAt(x) : 'x';
                heights[y][x] = Character.isDigit(c) ? c - '0' : VOID;
            }
        }
        return new RoomLayout(heights, width, rows.length);
    }

    public int width() {
        return width;
    }

    public int height() {
        return height;
    }

    public boolean isTile(int x, int y) {
        return x >= 0 && y >= 0 && x < width && y < height && heights[y][x] != VOID;
    }

    /** Altezza della casella, oppure -1 se la casella non esiste. */
    public int heightAt(int x, int y) {
        return isTile(x, y) ? heights[y][x] : VOID;
    }
}
