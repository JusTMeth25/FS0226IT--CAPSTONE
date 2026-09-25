package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Le stanze pubbliche vere, lette dal database: ogni NPC di NpcRoster deve partire da una
 * casella libera, raggiungibile dalla porta. Le posizioni stanno nel codice, la pianta nella
 * migrazione: questo test si accorge se le due cose si separano.
 */
@SpringBootTest
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class PublicRoomsIntegrationTest {

    @Autowired
    private RoomService roomService;

    @Test
    @DisplayName("Ogni NPC delle stanze pubbliche parte da una casella libera e raggiungibile")
    void npcsStandOnFreeReachableTiles() {
        for (UUID roomId : NpcRoster.rooms()) {
            RoomData data = roomService.load(roomId).orElseThrow(() -> new AssertionError("stanza mancante: " + roomId));
            List<RoomItemView> items = roomService.loadItems(roomId);
            RoomLayout layout = RoomLayout.parse(data.layout());
            for (NpcRoster.NpcSpec npc : NpcRoster.forRoom(roomId)) {
                String where = data.name() + ", " + npc.name() + " in " + npc.x() + "," + npc.y();
                assertTrue(layout.isTile(npc.x(), npc.y()), where + ": fuori dalla stanza");
                boolean onSolid = items.stream().anyMatch(i -> i.covers(npc.x(), npc.y()) && !i.def().passable());
                assertFalse(onSolid, where + ": sopra un mobile");
                List<Pathfinder.Step> path = Pathfinder.find(layout, data.doorX(), data.doorY(), npc.x(), npc.y(),
                        (x, y) -> items.stream().anyMatch(i -> i.covers(x, y) && !i.def().passable()));
                assertFalse(path.isEmpty(), where + ": non raggiungibile dalla porta");
            }
        }
    }

    @Test
    @DisplayName("Le stanze pubbliche sono spaziose, come i locali di Habbo")
    void publicRoomsAreBig() {
        for (UUID roomId : NpcRoster.rooms()) {
            RoomData data = roomService.load(roomId).orElseThrow();
            RoomLayout layout = RoomLayout.parse(data.layout());
            assertTrue(layout.width() * layout.height() >= 20 * 18, data.name() + " e' troppo piccola");
        }
    }
}
