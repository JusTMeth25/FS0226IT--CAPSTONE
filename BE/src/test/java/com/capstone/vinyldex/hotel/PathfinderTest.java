package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PathfinderTest {

    private static final RoomLayout OPEN_ROOM = RoomLayout.parse("""
            00000
            00000
            00000
            00000""");

    @Test
    @DisplayName("In una stanza libera la diagonale e' il percorso piu' breve")
    void diagonalIsShortest() {
        List<Pathfinder.Step> path = Pathfinder.find(OPEN_ROOM, 0, 0, 3, 3, (x, y) -> false);

        assertEquals(3, path.size());
        assertEquals(new Pathfinder.Step(3, 3, 0), path.getLast());
    }

    @Test
    @DisplayName("Gli ostacoli si aggirano")
    void avoidsObstacles() {
        Set<String> wall = Set.of("2,0", "2,1", "2,2");
        List<Pathfinder.Step> path = Pathfinder.find(OPEN_ROOM, 0, 0, 4, 0, (x, y) -> wall.contains(x + "," + y));

        assertTrue(path.stream().noneMatch(s -> wall.contains(s.x() + "," + s.y())));
        assertEquals(new Pathfinder.Step(4, 0, 0), path.getLast());
    }

    @Test
    @DisplayName("In diagonale non si taglia lo spigolo di un ostacolo")
    void noCornerCutting() {
        List<Pathfinder.Step> path = Pathfinder.find(OPEN_ROOM, 0, 0, 1, 1, (x, y) -> x == 1 && y == 0);

        assertEquals(2, path.size(), "deve passare da (0,1) invece di tagliare lo spigolo");
        assertEquals(new Pathfinder.Step(0, 1, 0), path.getFirst());
    }

    @Test
    @DisplayName("Caselle vuote, occupate o uguali alla partenza non producono un percorso")
    void unreachableTargets() {
        RoomLayout withHole = RoomLayout.parse("""
                00x
                000""");

        assertTrue(Pathfinder.find(withHole, 0, 0, 2, 0, (x, y) -> false).isEmpty(), "casella vuota");
        assertTrue(Pathfinder.find(withHole, 0, 0, 1, 1, (x, y) -> x == 1 && y == 1).isEmpty(), "occupata");
        assertTrue(Pathfinder.find(withHole, 0, 0, 0, 0, (x, y) -> false).isEmpty(), "stessa casella");
        assertTrue(Pathfinder.find(withHole, 0, 0, 9, 9, (x, y) -> false).isEmpty(), "fuori dalla stanza");
    }

    @Test
    @DisplayName("Si sale un gradino alla volta, non un muro di due livelli")
    void heightDifference() {
        RoomLayout stairs = RoomLayout.parse("0120");
        RoomLayout wall = RoomLayout.parse("020");

        List<Pathfinder.Step> climb = Pathfinder.find(stairs, 0, 0, 2, 0, (x, y) -> false);
        assertEquals(2, climb.getLast().z());
        assertTrue(Pathfinder.find(wall, 0, 0, 2, 0, (x, y) -> false).isEmpty());
    }
}
