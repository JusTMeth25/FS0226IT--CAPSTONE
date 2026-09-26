package com.capstone.vinyldex.hotel;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Personaggi non giocanti delle stanze pubbliche, come i bot di Habbo.
 *
 * I lavoratori (receptionist, baristi, camerieri, bagnino, DJ, gelataio) hanno un posto fisso o
 * un giro da fare e un menu da servire; gli ospiti passeggiano, si siedono e ballano. Stanno nel
 * codice e non nel database: nascono con la stanza quando entra il primo giocatore e spariscono
 * quando la stanza viene scaricata.
 */
public final class NpcRoster {

    public static final UUID LOBBY = UUID.fromString("00000000-0000-0000-0000-00000000a001");
    public static final UUID ARENA = UUID.fromString("00000000-0000-0000-0000-00000000a002");
    public static final UUID RELAX = UUID.fromString("00000000-0000-0000-0000-00000000a003");
    public static final UUID POOL = UUID.fromString("00000000-0000-0000-0000-00000000a004");
    public static final UUID NEON_BAR = UUID.fromString("00000000-0000-0000-0000-00000000a005");
    public static final UUID GARDEN = UUID.fromString("00000000-0000-0000-0000-00000000a006");
    public static final UUID PIZZERIA = UUID.fromString("00000000-0000-0000-0000-00000000a007");
    public static final UUID GAMES = UUID.fromString("00000000-0000-0000-0000-00000000a008");
    public static final UUID LIBRARY = UUID.fromString("00000000-0000-0000-0000-00000000a009");
    public static final UUID ROOFTOP = UUID.fromString("00000000-0000-0000-0000-00000000a00a");
    public static final UUID BEACH = UUID.fromString("00000000-0000-0000-0000-00000000a00b");
    public static final UUID NEWSSTAND = UUID.fromString("00000000-0000-0000-0000-00000000a00c");
    public static final UUID CINEMA = UUID.fromString("00000000-0000-0000-0000-00000000a00d");
    public static final UUID GYM = UUID.fromString("00000000-0000-0000-0000-00000000a00e");
    public static final UUID STADIUM = UUID.fromString("00000000-0000-0000-0000-00000000a00f");
    public static final UUID BOWLING = UUID.fromString("00000000-0000-0000-0000-00000000a010");
    public static final UUID MINIGOLF = UUID.fromString("00000000-0000-0000-0000-00000000a011");
    public static final UUID BASKET = UUID.fromString("00000000-0000-0000-0000-00000000a012");

    /** Cosa fa il personaggio: da qui dipendono movimento, azioni possibili e battute. */
    public enum Role {
        RECEPTIONIST("Receptionist", false),
        BARISTA("Barista", false),
        WAITER("Cameriere", true),
        LIFEGUARD("Bagnino", false),
        DJ("DJ", false),
        ICE_CREAM("Gelataio", false),
        GARDENER("Giardiniere", true),
        REFEREE("Arbitro", false),
        CHEF("Pizzaiolo", false),
        LIBRARIAN("Bibliotecaria", false),
        NEWSAGENT("Edicolante", false),
        USHER("Maschera", true),
        TRAINER("Istruttore", true),
        FIGHTER("Sfidante", true),
        FOOTBALLER("Calciatore", true),
        GUEST("Ospite", true);

        private final String title;
        private final boolean wanders;

        Role(String title, boolean wanders) {
            this.title = title;
            this.wanders = wanders;
        }

        public String title() {
            return title;
        }

        public boolean wanders() {
            return wanders;
        }
    }

    /**
     * @param key    nome breve e stabile, da cui si ricava l'id
     * @param menu   cosa sa servire (vuoto per chi non serve nulla); i nomi sono gli oggetti in mano
     * @param radius quanto si allontana da casa chi passeggia
     */
    public record NpcSpec(String key, String name, Role role, String look, int x, int y, int dir,
                          List<String> menu, int radius) {

        public UUID id(UUID roomId) {
            return UUID.nameUUIDFromBytes((roomId + "/" + key).getBytes(StandardCharsets.UTF_8));
        }

        public boolean serves() {
            return !menu.isEmpty();
        }
    }

    private static NpcSpec worker(String key, String name, Role role, String look, int x, int y, int dir, String... menu) {
        return new NpcSpec(key, name, role, look, x, y, dir, List.of(menu), 0);
    }

    private static NpcSpec walker(String key, String name, Role role, String look, int x, int y, int radius, String... menu) {
        return new NpcSpec(key, name, role, look, x, y, 4, List.of(menu), radius);
    }

    /** Posizioni generate da BE/scripts/hotel_rooms.py insieme alla pianta delle stanze. */
    private static final Map<UUID, List<NpcSpec>> ROSTER = Map.ofEntries(
            Map.entry(LOBBY, List.of(
                    worker("vera", "Vera", Role.RECEPTIONIST, "s1.h8.hc6.sh0.p1.t2.f0.a1.b1", 3, 15, 2),
                    worker("marco", "Marco", Role.BARISTA, "s3.h0.hc0.sh8.p1.t3.f0.a0", 19, 3, 4, "coffee", "cola", "juice", "bubble"),
                    walker("leo", "Leo", Role.WAITER, "s2.h9.hc7.sh7.p1.t2.f0.a0", 20, 11, 5, "coffee", "cola", "juice"),
                    walker("sofia", "Sofia", Role.GUEST, "s0.h2.hc2.sh1.p3.t1.f1.a3.b1", 10, 15, 5),
                    walker("greta", "Greta", Role.GUEST, "s1.h6.hc3.sh4.p3.t4.f3.a1.b1", 19, 21, 4))),
            Map.entry(ARENA, List.of(
                    worker("rocco", "Rocco", Role.REFEREE, "s4.h9.hc7.sh8.p1.t0.f0.a0", 12, 7, 4),
                    walker("dario", "Dario", Role.FIGHTER, "s2.h4.hc6.sh6.p1.t0.f2.a0", 5, 16, 4),
                    walker("kira", "Kira", Role.FIGHTER, "s0.h7.hc4.sh9.p1.t3.f3.a2.b1", 20, 15, 4),
                    walker("brutus", "Brutus", Role.FIGHTER, "s4.h9.hc7.sh6.p5.t4.f0.a6", 4, 4, 3))),
            Map.entry(RELAX, List.of(
                    walker("luna", "Luna", Role.WAITER, "s1.h3.hc1.sh11.p1.t2.f0.a0.b1", 12, 12, 6, "tea", "coffee"),
                    walker("otto", "Otto", Role.GUEST, "s2.h0.hc9.sh3.p0.t3.f4.a1", 17, 14, 5),
                    walker("mira", "Mira", Role.GUEST, "s5.h6.hc0.sh4.p6.t1.f3.a5.b1", 7, 13, 5))),
            Map.entry(POOL, List.of(
                    worker("rico", "Rico", Role.BARISTA, "s3.h5.hc5.sh10.p0.t0.f1.a2", 11, 3, 4, "cocktail", "juice", "cola", "bubble"),
                    worker("bruno", "Bruno", Role.LIFEGUARD, "s4.h9.hc7.sh6.p5.t4.f2.a2", 20, 13, 6),
                    walker("nina", "Nina", Role.GUEST, "s0.h7.hc4.sh2.p3.t4.f5.a2.b1", 13, 12, 4),
                    walker("teo", "Teo", Role.GUEST, "s2.h1.hc8.sh5.p7.t4.f1.a0", 6, 19, 4))),
            Map.entry(NEON_BAR, List.of(
                    worker("vinnie", "Vinnie", Role.BARISTA, "s2.h4.hc4.sh9.p1.t3.f0.a4", 3, 5, 2, "cocktail", "cola", "bubble", "juice"),
                    worker("byte", "DJ Byte", Role.DJ, "s5.h1.hc5.sh8.p1.t1.f5.a3", 12, 2, 4),
                    walker("gio", "Gio", Role.WAITER, "s1.h0.hc1.sh7.p1.t2.f0.a0", 17, 12, 5, "cocktail", "cola", "bubble"),
                    walker("stella", "Stella", Role.GUEST, "s0.h2.hc6.sh1.p4.t4.f3.a4.b1", 12, 11, 3),
                    walker("remo", "Remo", Role.GUEST, "s3.h4.hc0.sh9.p0.t1.f2.a3", 20, 11, 4))),
            Map.entry(GARDEN, List.of(
                    worker("gigi", "Gigi", Role.ICE_CREAM, "s1.h5.hc7.sh7.p3.t0.f1.a0", 24, 16, 4, "gelato"),
                    walker("flora", "Flora", Role.GARDENER, "s3.h7.hc1.sh5.p7.t2.f4.a6.b1", 6, 15, 5),
                    walker("pietro", "Pietro", Role.GUEST, "s0.h1.hc3.sh10.p0.t0.f1.a0", 18, 7, 5),
                    walker("alma", "Alma", Role.GUEST, "s5.h8.hc2.sh3.p3.t1.f1.a5.b1", 11, 19, 4))),
            Map.entry(PIZZERIA, List.of(
                    worker("salvatore", "Salvatore", Role.CHEF, "s2.h5.hc7.sh7.p1.t2.f0.a0", 8, 3, 4, "pizza"),
                    walker("carla", "Carla", Role.WAITER, "s1.h7.hc1.sh6.p1.t2.f0.a0.b1", 11, 10, 6, "pizza", "cola", "juice"),
                    walker("enzo", "Enzo", Role.GUEST, "s3.h0.hc7.sh3.p0.t3.f4.a1", 15, 14, 4))),
            Map.entry(GAMES, List.of(
                    walker("tito", "Tito", Role.WAITER, "s4.h9.hc7.sh2.p1.t0.f1.a3", 11, 10, 6, "cola", "bubble"),
                    walker("pixel", "Pixel", Role.GUEST, "s0.h4.hc5.sh8.p1.t1.f5.a3", 10, 3, 4),
                    walker("max", "Max", Role.GUEST, "s2.h1.hc0.sh6.p0.t0.f2.a2", 16, 15, 4))),
            Map.entry(LIBRARY, List.of(
                    worker("agata", "Agata", Role.LIBRARIAN, "s1.h3.hc9.sh11.p1.t2.f4.a1.b1", 8, 6, 4, "book", "tea"),
                    walker("ugo", "Ugo", Role.GUEST, "s3.h9.hc9.sh7.p7.t3.f4.a1", 8, 16, 4),
                    walker("lia", "Lia", Role.GUEST, "s0.h8.hc8.sh4.p3.t1.f1.a0.b1", 19, 12, 4))),
            Map.entry(ROOFTOP, List.of(
                    worker("nico", "Nico", Role.BARISTA, "s5.h0.hc7.sh8.p1.t3.f0.a2", 11, 3, 4, "cocktail", "bubble", "juice"),
                    walker("bea", "Bea", Role.GUEST, "s1.h2.hc4.sh1.p4.t4.f3.a2.b1", 16, 16, 5),
                    walker("ivo", "Ivo", Role.GUEST, "s2.h1.hc3.sh10.p0.t0.f1.a0", 7, 17, 4))),
            Map.entry(BEACH, List.of(
                    worker("sandro", "Sandro", Role.BARISTA, "s4.h1.hc4.sh10.p0.t0.f1.a2", 10, 2, 4, "cocktail", "juice", "cola", "gelato"),
                    worker("marina", "Marina", Role.LIFEGUARD, "s1.h7.hc2.sh6.p5.t4.f2.a2.b1", 17, 15, 2),
                    walker("kai", "Kai", Role.GUEST, "s3.h5.hc4.sh2.p7.t4.f1.a0", 24, 12, 4),
                    walker("sole", "Sole", Role.GUEST, "s0.h8.hc5.sh10.p3.t4.f3.a2.b1", 10, 18, 5),
                    walker("tommy", "Tommy", Role.GUEST, "s2.h9.hc3.sh5.p0.t0.f5.a3", 7, 23, 4))),
            Map.entry(NEWSSTAND, List.of(
                    worker("edo", "Edo", Role.NEWSAGENT, "s3.h1.hc9.sh4.p1.t2.f4.a1", 9, 3, 4),
                    walker("nando", "Nando", Role.GUEST, "s2.h0.hc2.sh9.p0.t0.f2.a0", 12, 10, 4),
                    walker("bianca", "Bianca", Role.GUEST, "s0.h3.hc6.sh1.p3.t1.f3.a5.b1", 6, 16, 4))),
            Map.entry(CINEMA, List.of(
                    walker("mario", "Mario", Role.USHER, "s2.h9.hc0.sh8.p1.t2.f0.a0", 18, 21, 4, "popcorn", "cola"),
                    walker("irene", "Irene", Role.GUEST, "s1.h6.hc4.sh11.p4.t1.f3.a2.b1", 11, 13, 5),
                    walker("fede", "Fede", Role.GUEST, "s3.h2.hc7.sh2.p0.t3.f1.a1", 11, 18, 4))),
            Map.entry(GYM, List.of(
                    walker("sara", "Sara", Role.TRAINER, "s1.h4.hc4.sh9.p1.t0.f5.a2.b1", 13, 11, 6, "water"),
                    walker("gino", "Gino", Role.GUEST, "s4.h9.hc7.sh6.p5.t0.f0.a0", 9, 18, 4),
                    walker("vale", "Vale", Role.GUEST, "s0.h7.hc1.sh6.p1.t0.f5.a3.b1", 17, 14, 4))),
            // Calciatori: chi parte dalla meta' ovest gioca con i Blu, gli altri con i Rossi (FootballMatch).
            Map.entry(STADIUM, List.of(
                    walker("bomber", "Bomber", Role.FOOTBALLER, "s2.h9.hc0.sh3.p0.t0.f1.a0", 12, 8, 10),
                    walker("mago", "Mago", Role.FOOTBALLER, "s4.h1.hc4.sh3.p0.t0.f1.a0", 12, 16, 10),
                    walker("razzo", "Razzo", Role.FOOTBALLER, "s1.h0.hc2.sh6.p0.t0.f1.a0", 24, 8, 10),
                    walker("muro", "Muro", Role.FOOTBALLER, "s3.h9.hc7.sh6.p0.t0.f1.a0", 24, 16, 10),
                    walker("ultra", "Ultra", Role.GUEST, "s0.h3.hc6.sh1.p3.t1.f3.a5.b1", 16, 3, 4))),
            Map.entry(BOWLING, List.of(
                    worker("rita", "Rita", Role.BARISTA, "s0.h2.hc5.sh1.p3.t1.f3.a2.b1", 22, 2, 4, "cola", "juice", "bubble"),
                    worker("beppe", "Beppe", Role.RECEPTIONIST, "s3.h1.hc2.sh7.p1.t2.f0.a1", 2, 17, 0),
                    walker("strike", "Strike", Role.GUEST, "s2.h9.hc0.sh6.p0.t0.f1.a0", 20, 12, 4),
                    walker("lulu", "Lulu", Role.GUEST, "s1.h7.hc4.sh2.p4.t4.f2.a2.b1", 11, 13, 4))),
            Map.entry(MINIGOLF, List.of(
                    worker("gigi", "Gigi", Role.ICE_CREAM, "s1.h0.hc3.sh7.p1.t2.f0.a0", 3, 22, 2, "gelato"),
                    walker("birdie", "Birdie", Role.GUEST, "s1.h6.hc1.sh5.p3.t1.f1.a2.b1", 16, 16, 5),
                    walker("par", "Par", Role.GUEST, "s4.h9.hc7.sh3.p0.t2.f0.a0", 12, 9, 5))),
            Map.entry(BASKET, List.of(
                    walker("tripla", "Tripla", Role.GUEST, "s3.h9.hc0.sh7.p0.t4.f1.a0", 10, 12, 5),
                    walker("schiacciata", "Schiacciata", Role.GUEST, "s5.h0.hc2.sh6.p0.t4.f1.a0", 20, 12, 5),
                    walker("tifosa", "Tifosa", Role.GUEST, "s0.h3.hc6.sh1.p3.t1.f3.a5.b1", 15, 3, 3)))
    );

    private NpcRoster() {
    }

    /** Le stanze pubbliche con del personale. */
    public static Set<UUID> rooms() {
        return ROSTER.keySet();
    }

    public static List<NpcSpec> forRoom(UUID roomId) {
        return roomId == null ? List.of() : ROSTER.getOrDefault(roomId, List.of());
    }
}
