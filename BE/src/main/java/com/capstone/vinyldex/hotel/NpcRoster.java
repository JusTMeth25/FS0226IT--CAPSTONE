package com.capstone.vinyldex.hotel;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
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

    private static final Map<UUID, List<NpcSpec>> ROSTER = Map.ofEntries(
            Map.entry(PIZZERIA, List.of(
                    worker("salvatore", "Salvatore", Role.CHEF, "s2.h5.hc7.sh7.p1.t2.f0.a0", 5, 2, 4, "pizza"),
                    walker("carla", "Carla", Role.WAITER, "s1.h7.hc1.sh6.p1.t2.f0.a0", 6, 8, 3, "pizza", "cola", "juice"),
                    walker("enzo", "Enzo", Role.GUEST, "s3.h0.hc7.sh3.p0.t3.f4.a1", 9, 9, 3))),
            Map.entry(GAMES, List.of(
                    walker("tito", "Tito", Role.WAITER, "s4.h9.hc7.sh2.p1.t0.f1.a3", 6, 8, 3, "cola", "bubble"),
                    walker("pixel", "Pixel", Role.GUEST, "s0.h4.hc5.sh8.p1.t1.f5.a3", 4, 3, 3),
                    walker("max", "Max", Role.GUEST, "s2.h1.hc0.sh6.p0.t0.f2.a2", 8, 7, 3))),
            Map.entry(LIBRARY, List.of(
                    worker("agata", "Agata", Role.LIBRARIAN, "s1.h3.hc9.sh11.p1.t2.f4.a1", 6, 3, 4, "book", "tea"),
                    walker("ugo", "Ugo", Role.GUEST, "s3.h9.hc9.sh7.p7.t3.f4.a1", 3, 9, 2),
                    walker("lia", "Lia", Role.GUEST, "s0.h8.hc8.sh4.p3.t1.f1.a0", 8, 9, 2))),
            Map.entry(ROOFTOP, List.of(
                    worker("nico", "Nico", Role.BARISTA, "s5.h0.hc7.sh8.p1.t3.f0.a2", 6, 1, 4, "cocktail", "bubble", "juice"),
                    walker("bea", "Bea", Role.GUEST, "s1.h2.hc4.sh1.p4.t4.f3.a2", 9, 8, 4),
                    walker("ivo", "Ivo", Role.GUEST, "s2.h1.hc3.sh10.p0.t0.f1.a0", 4, 8, 3))),
            Map.entry(LOBBY, List.of(
                    worker("vera", "Vera", Role.RECEPTIONIST, "s1.h8.hc6.sh0.p1.t2.f0.a1", 3, 5, 6),
                    worker("marco", "Marco", Role.BARISTA, "s3.h0.hc0.sh8.p1.t3.f0.a0", 15, 2, 6, "coffee", "cola", "juice", "bubble"),
                    walker("leo", "Leo", Role.WAITER, "s2.h9.hc7.sh7.p1.t2.f0.a0", 12, 8, 3, "coffee", "cola", "juice"),
                    walker("sofia", "Sofia", Role.GUEST, "s0.h2.hc2.sh1.p3.t1.f1.a3", 8, 11, 5))),
            Map.entry(ARENA, List.of(
                    worker("rocco", "Rocco", Role.REFEREE, "s4.h9.hc7.sh8.p1.t0.f0.a0", 9, 3, 6),
                    walker("dario", "Dario", Role.GUEST, "s2.h4.hc6.sh6.p1.t0.f2.a0", 3, 6, 2))),
            Map.entry(RELAX, List.of(
                    walker("luna", "Luna", Role.WAITER, "s1.h3.hc1.sh11.p1.t2.f0.a0", 6, 7, 3, "tea", "coffee"),
                    walker("otto", "Otto", Role.GUEST, "s2.h0.hc9.sh3.p0.t3.f4.a1", 8, 9, 4),
                    walker("mira", "Mira", Role.GUEST, "s5.h6.hc0.sh4.p6.t1.f3.a5", 3, 8, 3))),
            Map.entry(POOL, List.of(
                    worker("rico", "Rico", Role.BARISTA, "s3.h5.hc5.sh10.p0.t0.f1.a2", 7, 1, 4, "cocktail", "juice", "cola", "bubble"),
                    worker("bruno", "Bruno", Role.LIFEGUARD, "s4.h9.hc7.sh6.p5.t4.f2.a2", 11, 5, 6),
                    walker("nina", "Nina", Role.GUEST, "s0.h7.hc4.sh2.p3.t4.f5.a2", 6, 6, 4),
                    walker("teo", "Teo", Role.GUEST, "s2.h1.hc8.sh5.p7.t4.f1.a0", 3, 9, 3))),
            Map.entry(NEON_BAR, List.of(
                    worker("vinnie", "Vinnie", Role.BARISTA, "s2.h4.hc4.sh9.p1.t3.f0.a4", 5, 1, 4, "cocktail", "cola", "bubble", "juice"),
                    worker("byte", "DJ Byte", Role.DJ, "s5.h1.hc5.sh8.p1.t1.f5.a3", 8, 1, 4),
                    walker("gio", "Gio", Role.WAITER, "s1.h0.hc1.sh7.p1.t2.f0.a0", 4, 7, 3, "cocktail", "cola", "bubble"),
                    walker("stella", "Stella", Role.GUEST, "s0.h2.hc6.sh1.p4.t4.f3.a4", 8, 7, 2))),
            Map.entry(GARDEN, List.of(
                    worker("gigi", "Gigi", Role.ICE_CREAM, "s1.h5.hc7.sh7.p3.t0.f1.a0", 11, 9, 4, "gelato"),
                    walker("flora", "Flora", Role.GARDENER, "s3.h7.hc1.sh5.p7.t2.f4.a6", 4, 10, 4),
                    walker("pietro", "Pietro", Role.GUEST, "s0.h1.hc3.sh10.p0.t0.f1.a0", 9, 3, 4)))
    );

    private NpcRoster() {
    }

    public static List<NpcSpec> forRoom(UUID roomId) {
        return roomId == null ? List.of() : ROSTER.getOrDefault(roomId, List.of());
    }
}
