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
        // Teca 3D: la carta gira dentro una campana di vetro. Premio degli incarichi piu' difficili.
        add(new FurniDef("card_case", "Teca 3D", "carte", 600, 1, 1, false, false, -1, true, true));
        // Bacheca dei distintivi: a parete, mostra tutti i distintivi del padrone della stanza.
        add(new FurniDef("badge_board", "Bacheca distintivi", "carte", 250, 1, 1, true, false, -1, false, true));
        add(new FurniDef("poster_neon", "Poster neon", "pareti", 40, 1, 1, true, false, -1, false, true));
        add(new FurniDef("armchair", "Poltrona", "sedute", 90, 1, 1, false, false, 2, false, true));
        add(new FurniDef("bar_stool", "Sgabello", "sedute", 35, 1, 1, false, false, 2, false, true));
        add(new FurniDef("beanbag", "Pouf", "sedute", 55, 1, 1, false, false, 2, false, true));
        add(new FurniDef("cafe_table", "Tavolino bistrot", "arredo", 50, 1, 1, false, false, -1, false, true));
        add(new FurniDef("coffee_table", "Tavolino basso", "arredo", 80, 2, 1, false, false, -1, false, true));
        add(new FurniDef("bookshelf", "Libreria", "arredo", 140, 1, 1, false, false, -1, false, true));
        add(new FurniDef("plant_big", "Ficus", "arredo", 70, 1, 1, false, false, -1, false, true));
        add(new FurniDef("rug_round", "Tappeto tondo", "arredo", 70, 2, 2, false, true, -1, false, true));
        add(new FurniDef("arcade", "Cabinato arcade", "arredo", 300, 1, 1, false, false, -1, false, true));
        add(new FurniDef("cafe_counter", "Bancone caffe'", "caffe", 180, 2, 1, false, false, -1, false, true));
        add(new FurniDef("coffee_machine", "Macchina del caffe'", "caffe", 160, 1, 1, false, false, -1, false, true));
        add(new FurniDef("lamp_floor", "Lampada da terra", "luci", 60, 1, 1, false, false, -1, false, true));
        add(new FurniDef("turntable", "Giradischi", "musica", 220, 1, 1, false, false, -1, false, true));
        add(new FurniDef("record_shelf", "Espositore vinili", "musica", 130, 1, 1, false, false, -1, false, true));
        add(new FurniDef("neon_sign", "Insegna neon", "pareti", 90, 1, 1, true, false, -1, false, true));
        add(new FurniDef("window_wall", "Finestra", "pareti", 70, 1, 1, true, false, -1, false, true));
        add(new FurniDef("chalkboard", "Lavagna", "pareti", 60, 1, 1, true, false, -1, false, true));
        add(new FurniDef("pool_water", "Acqua della piscina", "piscina", 25, 1, 1, false, true, -1, false, true));
        add(new FurniDef("sunbed", "Lettino", "piscina", 70, 1, 1, false, false, 2, false, true));
        add(new FurniDef("umbrella", "Ombrellone", "piscina", 60, 1, 1, false, false, -1, false, true));
        add(new FurniDef("lifeguard_chair", "Sedia del bagnino", "piscina", 120, 1, 1, false, false, -1, false, true));
        add(new FurniDef("aquarium", "Acquario", "arredo", 250, 2, 1, false, false, -1, false, true));
        add(new FurniDef("fireplace", "Camino", "arredo", 220, 2, 1, false, false, -1, false, true));
        add(new FurniDef("bench", "Panchina", "giardino", 60, 2, 1, false, false, 4, false, true));
        add(new FurniDef("fountain", "Fontana", "giardino", 280, 2, 2, false, false, -1, false, true));
        add(new FurniDef("flower_bed", "Aiuola", "giardino", 40, 1, 1, false, false, -1, false, true));
        add(new FurniDef("icecream_cart", "Carretto dei gelati", "giardino", 200, 2, 1, false, false, -1, false, true));
        add(new FurniDef("pizza_oven", "Forno a legna", "caffe", 260, 2, 1, false, false, -1, false, true));
        add(new FurniDef("pool_table", "Biliardo", "giochi", 320, 2, 1, false, false, -1, false, true));
        add(new FurniDef("claw_machine", "Pesca-peluche", "giochi", 240, 1, 1, false, false, -1, false, true));
        add(new FurniDef("globe", "Mappamondo", "arredo", 90, 1, 1, false, false, -1, false, true));
        add(new FurniDef("fire_pit", "Braciere", "giardino", 150, 1, 1, false, false, -1, false, true));
        add(new FurniDef("beach_towel", "Telo da mare", "spiaggia", 30, 1, 2, false, true, -1, false, true));
        add(new FurniDef("sand_castle", "Castello di sabbia", "spiaggia", 45, 1, 1, false, false, -1, false, true));
        add(new FurniDef("beach_bar", "Chiosco in paglia", "spiaggia", 220, 2, 1, false, false, -1, false, true));
        add(new FurniDef("palm_tree", "Palma", "spiaggia", 90, 1, 1, false, false, -1, false, true));
        add(new FurniDef("volley_net", "Rete da beach volley", "spiaggia", 110, 3, 1, false, false, -1, false, true));
        add(new FurniDef("magazine_rack", "Espositore riviste", "arredo", 60, 1, 1, false, false, -1, false, true));
        add(new FurniDef("street_lamp", "Lampione", "luci", 70, 1, 1, false, false, -1, false, true));
        add(new FurniDef("cinema_seat", "Poltroncina del cinema", "cinema", 50, 1, 1, false, false, 0, false, true));
        add(new FurniDef("popcorn_machine", "Macchina dei popcorn", "cinema", 150, 1, 1, false, false, -1, false, true));
        add(new FurniDef("movie_poster", "Locandina", "pareti", 50, 1, 1, true, false, -1, false, true));
        add(new FurniDef("treadmill", "Tapis roulant", "palestra", 260, 1, 2, false, false, -1, false, true));
        add(new FurniDef("weight_bench", "Panca pesi", "palestra", 140, 2, 1, false, false, 4, false, true));
        add(new FurniDef("punching_bag", "Sacco da boxe", "palestra", 120, 1, 1, false, false, -1, false, true));
        add(new FurniDef("yoga_mat", "Tappetino", "palestra", 35, 1, 2, false, true, -1, false, true));
        add(new FurniDef("dumbbell_rack", "Rastrelliera manubri", "palestra", 130, 2, 1, false, false, -1, false, true));
        add(new FurniDef("water_cooler", "Distributore d'acqua", "palestra", 90, 1, 1, false, false, -1, false, true));
        add(new FurniDef("bar_counter", "Bancone bar", "lobby", 0, 3, 1, false, false, -1, false, false));
        add(new FurniDef("dj_booth", "Consolle DJ", "lobby", 0, 2, 1, false, false, -1, false, false));
        // Arredi fissi dei locali pubblici: il mare, l'edicola, lo schermo del cinema.
        add(new FurniDef("sea_water", "Mare", "spiaggia", 0, 2, 2, false, true, -1, false, false));
        add(new FurniDef("sea_foam", "Battigia", "spiaggia", 0, 1, 1, false, true, -1, false, false));
        add(new FurniDef("newsstand", "Chiosco dell'edicola", "edicola", 0, 3, 1, false, false, -1, false, false));
        add(new FurniDef("pack_display", "Espositore pacchetti", "edicola", 0, 1, 1, false, false, -1, false, false));
        add(new FurniDef("cinema_screen", "Schermo del cinema", "cinema", 0, 6, 1, false, false, -1, false, false));
        // Stadio: con due porte la stanza ha il pallone (FootballMatch).
        add(new FurniDef("football_goal", "Porta da calcio", "stadio", 0, 1, 3, false, false, -1, false, false));
        add(new FurniDef("corner_flag", "Bandierina", "stadio", 0, 1, 1, false, false, -1, false, false));
        add(new FurniDef("floodlight", "Torre faro", "stadio", 0, 1, 1, false, false, -1, false, false));
        add(new FurniDef("scoreboard", "Tabellone", "stadio", 0, 1, 1, true, false, -1, false, false));
        add(new FurniDef("basket_hoop", "Canestro", "stadio", 0, 1, 1, false, false, -1, false, false));
        add(new FurniDef("billiard_table", "Tavolo da biliardo", "giochi", 0, 4, 2, false, false, -1, false, false));
        add(new FurniDef("comic_shelf", "Scaffale di fumetti", "arredo", 120, 1, 1, false, false, -1, false, true));
        // Bowling e minigolf: piste e buche sono minigiochi (Minigames).
        add(new FurniDef("bowling_lane", "Pista da bowling", "bowling", 0, 1, 8, false, false, -1, false, false));
        add(new FurniDef("bowling_rack", "Rastrelliera palle da bowling", "bowling", 0, 1, 1, false, false, -1, false, false));
        add(new FurniDef("shoe_counter", "Banco noleggio scarpe", "bowling", 0, 2, 1, false, false, -1, false, false));
        for (int hole = 1; hole <= Minigames.GOLF_HOLES; hole++) {
            add(new FurniDef("golf_hole_" + hole, "Minigolf, buca " + hole, "minigolf", 0, 3, 2, false, false, -1, false, false));
        }
        // Karaoke del Neon Bar, pesca dalla spiaggia e go-kart: minigiochi (Minigames).
        add(new FurniDef("karaoke_stage", "Palco del karaoke", "musica", 0, 2, 2, false, false, -1, false, false));
        add(new FurniDef("fishing_post", "Paletto da pesca", "spiaggia", 0, 1, 1, false, false, -1, false, false));
        add(new FurniDef("go_kart", "Go-kart", "kart", 0, 1, 1, false, false, 2, false, false));
        add(new FurniDef("tire_stack", "Pila di gomme", "kart", 40, 1, 1, false, false, -1, false, true));
        // Banchetto: si mettono in vendita carte della propria collezione (CommunityService).
        // Ping pong e freccette in sala giochi: minigiochi (Minigames).
        add(new FurniDef("ping_pong_table", "Tavolo da ping pong", "giochi", 0, 3, 2, false, false, -1, false, false));
        add(new FurniDef("dart_board", "Bersaglio delle freccette", "giochi", 0, 1, 1, false, false, -1, false, false));
        add(new FurniDef("card_stall", "Banchetto delle carte", "carte", 150, 2, 1, false, false, -1, false, true));
        add(new FurniDef("race_lights", "Semaforo di partenza", "kart", 0, 1, 1, false, false, -1, false, false));
        // Disco anni 80: piastrelle luminose della pista (si calpestano) e pedana della gara di ballo (Minigames).
        add(new FurniDef("fever_tile", "Piastrella luminosa anni 80", "musica", 70, 1, 1, false, true, -1, false, true));
        add(new FurniDef("dance_contest", "Pedana della gara di ballo", "musica", 0, 2, 2, false, false, -1, false, false));
        // Negozi del quartiere: il bancone apre il negozio (LuxuryCatalog), il resto e' merce esposta.
        add(new FurniDef("atelier_counter", "Banco dell'atelier", "negozi", 0, 2, 1, false, false, -1, false, false));
        add(new FurniDef("watch_counter", "Banco della gioielleria", "negozi", 0, 2, 1, false, false, -1, false, false));
        add(new FurniDef("skate_counter", "Banco dello skate shop", "negozi", 0, 2, 1, false, false, -1, false, false));
        add(new FurniDef("bike_counter", "Banco delle bici", "negozi", 0, 2, 1, false, false, -1, false, false));
        add(new FurniDef("car_counter", "Scrivania del concessionario", "negozi", 0, 2, 1, false, false, -1, false, false));
        add(new FurniDef("mannequin_suit", "Manichino con completo", "negozi", 180, 1, 1, false, false, -1, false, true));
        add(new FurniDef("mannequin_gown", "Manichino con abito", "negozi", 180, 1, 1, false, false, -1, false, true));
        add(new FurniDef("clothes_rack", "Stender di abiti", "negozi", 150, 2, 1, false, false, -1, false, true));
        add(new FurniDef("tailor_mirror", "Specchio del sarto", "negozi", 120, 1, 1, false, false, -1, false, true));
        add(new FurniDef("watch_vitrine", "Vetrina di orologi", "negozi", 300, 1, 1, false, false, -1, false, true));
        add(new FurniDef("skate_rack", "Rastrelliera di skate", "negozi", 140, 2, 1, false, false, -1, false, true));
        add(new FurniDef("bike_display", "Bici esposta", "negozi", 200, 2, 1, false, false, -1, false, true));
        add(new FurniDef("car_display", "Auto in esposizione", "negozi", 0, 3, 3, false, false, -1, false, false));
        // Quartiere: facciate dei negozi e delle arene (ci si entra cliccandole), ville, strada.
        add(new FurniDef("facade_atelier", "Atelier di sartoria", "quartiere", 0, 4, 2, false, false, -1, false, false));
        add(new FurniDef("facade_watches", "Gioielleria", "quartiere", 0, 4, 2, false, false, -1, false, false));
        add(new FurniDef("facade_skate", "Skate shop", "quartiere", 0, 3, 2, false, false, -1, false, false));
        add(new FurniDef("facade_bikes", "Negozio di bici", "quartiere", 0, 3, 2, false, false, -1, false, false));
        add(new FurniDef("facade_cars", "Concessionaria", "quartiere", 0, 5, 2, false, false, -1, false, false));
        add(new FurniDef("facade_cafe", "Caffetteria", "quartiere", 0, 4, 2, false, false, -1, false, false));
        add(new FurniDef("arena_hockey", "Palaghiaccio", "quartiere", 0, 7, 3, false, false, -1, false, false));
        add(new FurniDef("arena_basket", "Arena del basket", "quartiere", 0, 7, 3, false, false, -1, false, false));
        add(new FurniDef("villa", "Villa", "quartiere", 0, 4, 3, false, false, -1, false, false));
        add(new FurniDef("traffic_light", "Semaforo", "quartiere", 0, 1, 1, false, false, -1, false, false));
        add(new FurniDef("bus_stop", "Fermata dell'autobus", "quartiere", 0, 2, 1, false, false, 4, false, false));
        add(new FurniDef("hydrant", "Idrante", "giardino", 30, 1, 1, false, false, -1, false, true));
        add(new FurniDef("street_tree", "Albero del viale", "giardino", 80, 1, 1, false, false, -1, false, true));
        // Caffetteria del quartiere: bancone dei baristi, vetrina dei dolci, poltrone verdi.
        add(new FurniDef("espresso_bar", "Bancone della caffetteria", "caffe", 0, 3, 1, false, false, -1, false, false));
        add(new FurniDef("pastry_case", "Vetrina dei dolci", "caffe", 160, 2, 1, false, false, -1, false, true));
        add(new FurniDef("armchair_green", "Poltrona verde", "sedute", 100, 1, 1, false, false, 2, false, true));
        // Palaghiaccio: porte da hockey (partita a squadre come il calcio) e bersaglio dei tiri.
        add(new FurniDef("hockey_goal", "Porta da hockey", "stadio", 0, 1, 2, false, false, -1, false, false));
        add(new FurniDef("hockey_target", "Bersaglio dei tiri", "stadio", 0, 2, 1, false, false, -1, false, false));
        add(new FurniDef("team_bench", "Panchina delle squadre", "stadio", 0, 3, 1, false, false, 4, false, false));
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
