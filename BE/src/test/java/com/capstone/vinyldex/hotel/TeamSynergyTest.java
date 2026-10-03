package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Bonus di squadra nelle sfide dell'hotel: stesse regole della pagina Battaglie. */
class TeamSynergyTest {

    private static PvpGame.CardInfo card(String id, String source, String artistClass, String kind, String set, String finish) {
        return new PvpGame.CardInfo(id, id, "rare", null, source, true,
                Map.of("fans", 100, "style", 100, "influence", 100, "energy", 100), finish, 0,
                artistClass, kind, set, 0);
    }

    @Test
    @DisplayName("Tre carte della stessa classe e dello stesso gioco: +12% +5% su tutte le statistiche")
    void sameClass() {
        TeamSynergy.Result r = TeamSynergy.apply(List.of(
                card("a", "original", "The Showman", null, null, null),
                card("b", "original", "The Showman", null, null, null),
                card("c", "original", "The Showman", null, null, null)));
        assertEquals(2, r.bonuses().size());
        assertEquals(117, r.team().get(0).stat("fans"));
        assertEquals(17, r.team().get(2).synergy());
    }

    @Test
    @DisplayName("Due Pokemon di tipo Fuoco: +5% solo a loro; il bonus non supera il 25%")
    void kindPairAndCap() {
        TeamSynergy.Result r = TeamSynergy.apply(List.of(
                card("a", "pokemon", null, "Fuoco", "Base", null),
                card("b", "pokemonjp", null, "Fuoco", null, null),
                card("c", "nba", null, "Lakers", null, null)));
        assertEquals(105, r.team().get(0).stat("fans"));
        assertEquals(100, r.team().get(2).stat("fans"));

        TeamSynergy.Result max = TeamSynergy.apply(List.of(
                card("a", "original", "The MVP", "x", "Court Legends", "illustration"),
                card("b", "original", "The MVP", "x", "Court Legends", "illustration"),
                card("c", "original", "The MVP", "x", "Court Legends", "illustration")));
        assertTrue(max.team().stream().allMatch(c -> c.synergy() == TeamSynergy.CAP));
        assertEquals(125, max.team().get(0).stat("style"));
    }
}
