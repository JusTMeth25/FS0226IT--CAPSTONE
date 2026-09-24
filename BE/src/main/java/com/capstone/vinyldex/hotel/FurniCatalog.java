package com.capstone.vinyldex.hotel;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Catalogo dei mobili dell'hotel.
 *
 * Sta nel codice e non nel database: forma, regole e prezzi vanno di pari passo con gli sprite
 * disegnati dal frontend (src/hotel/sprites/furni.js), che si identificano con lo stesso "type".
 * Il frontend legge questo catalogo da GET /api/furni/catalog, cosi' prezzi e ingombri hanno
 * una fonte sola.
 */
public final class FurniCatalog {

    /**
     * @param width   caselle lungo x con rot 0 (lungo y con rot 2)
     * @param length  caselle lungo y con rot 0 (lungo x con rot 2)
     * @param wall    si appende alla parete invece di stare sul pavimento
     * @param walkable ci si cammina sopra (tappeti, piastrelle)
     * @param sitDir  direzione in cui si guarda seduti con rot 0; -1 se non ci si siede
     * @param cardDisplay mostra una carta della collezione
     * @param buyable in vendita nel negozio; gli arredi fissi delle stanze pubbliche no
     */
    public record FurniDef(String type, String name, String category, int price, int width, int length,
                           boolean wall, boolean walkable, int sitDir, boolean cardDisplay, boolean buyable) {

        public boolean sittable() {
            return sitDir >= 0;
        }

        /** Un avatar puo' finire su questa casella: tappeti, piastrelle e sedute. */
        public boolean passable() {
            return walkable || sittable();
        }

        /** Direzione da seduti con la rotazione data: girare il mobile scambia est e sud. */
        public int sitDirFor(int rot) {
            if (rot == 0) return sitDir;
            return sitDir == 2 ? 4 : sitDir == 4 ? 2 : sitDir;
        }

        public int footprintX(int rot) {
            return rot == 2 ? length : width;
        }

        public int footprintY(int rot) {
            return rot == 2 ? width : length;
        }
    }

    private static final Map<String, FurniDef> DEFS = new LinkedHashMap<>();

    private static void add(FurniDef def) {
        DEFS.put(def.type(), def);
    }

    static {
        //   type             nome                 categoria   prezzo  w  l  wall   walk   sit  card   buy
        add(new FurniDef("chair_neon", "Sedia neon", "sedute", 40, 1, 1, false, false, 2, false, true));
        add(new FurniDef("sofa_vinyl", "Divano vinile", "sedute", 120, 2, 1, false, false, 4, false, true));
        add(new FurniDef("table_round", "Tavolino", "arredo", 60, 1, 1, false, false, -1, false, true));
        add(new FurniDef("plant_palm", "Pianta", "arredo", 30, 1, 1, false, false, -1, false, true));
        add(new FurniDef("lamp_neon", "Lampada neon", "luci", 50, 1, 1, false, false, -1, false, true));
        add(new FurniDef("rug_vinyl", "Tappeto disco", "arredo", 80, 2, 2, false, true, -1, false, true));
        add(new FurniDef("speaker", "Cassa acustica", "musica", 90, 1, 1, false, false, -1, false, true));
        add(new FurniDef("jukebox", "Jukebox", "musica", 400, 1, 1, false, false, -1, false, true));
        add(new FurniDef("dance_tile", "Piastrella da ballo", "musica", 60, 1, 1, false, true, -1, false, true));
        add(new FurniDef("trophy", "Trofeo", "arredo", 200, 1, 1, false, false, -1, false, true));
        add(new FurniDef("card_pedestal", "Vetrina", "carte", 150, 1, 1, false, false, -1, true, true));
        add(new FurniDef("card_frame", "Quadro carta", "carte", 100, 1, 1, true, false, -1, true, true));
        add(new FurniDef("poster_neon", "Poster neon", "pareti", 40, 1, 1, true, false, -1, false, true));
        add(new FurniDef("bar_counter", "Bancone bar", "lobby", 0, 3, 1, false, false, -1, false, false));
        add(new FurniDef("dj_booth", "Consolle DJ", "lobby", 0, 2, 1, false, false, -1, false, false));
    }

    private FurniCatalog() {
    }

    public static Optional<FurniDef> get(String type) {
        return Optional.ofNullable(type == null ? null : DEFS.get(type));
    }

    public static List<FurniDef> all() {
        return List.copyOf(DEFS.values());
    }
}
