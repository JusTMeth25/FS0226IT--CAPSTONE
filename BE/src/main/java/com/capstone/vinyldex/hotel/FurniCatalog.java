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
     * @param width   caselle lungo x con rot 0 e 4 (lungo y con rot 2 e 6)
     * @param length  caselle lungo y con rot 0 e 4 (lungo x con rot 2 e 6)
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

        /**
         * Mobile "a terra" (tappeti, piastrelle): sta sotto gli altri, che ci si possono
         * appoggiare sopra. Due mobili a terra invece non si sovrappongono.
         */
        public boolean flat() {
            return walkable && !sittable() && !wall;
        }

        /**
         * Direzione da seduti con la rotazione data. Le quattro rotazioni sono lo scambio
         * degli assi (rot 2), il mezzo giro (rot 4) e le due cose insieme (rot 6): girano
         * lo schienale verso ognuno dei quattro lati.
         */
        public int sitDirFor(int rot) {
            int dir = (rot == 2 || rot == 6) ? swapAxes(sitDir) : sitDir;
            return (rot == 4 || rot == 6) ? (dir + 4) % 8 : dir;
        }

        public int footprintX(int rot) {
            return (rot == 2 || rot == 6) ? length : width;
        }

        public int footprintY(int rot) {
            return (rot == 2 || rot == 6) ? width : length;
        }

        /** Rotazioni ammesse: quattro per i mobili a pavimento, due (una per parete) per quelli appesi. */
        public int normalizeRot(int rot) {
            int r = Math.floorMod(rot, 8) & ~1;
            return wall ? r % 4 : r;
        }

        /** Scambiare gli assi porta est in sud e nord in ovest (e viceversa). */
        private static int swapAxes(int dir) {
            return switch (dir) {
                case 2 -> 4;
                case 4 -> 2;
                case 0 -> 6;
                case 6 -> 0;
                default -> dir;
            };
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
