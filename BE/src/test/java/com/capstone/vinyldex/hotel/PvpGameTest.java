package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PvpGameTest {

    private final UUID anna = UUID.randomUUID();
    private final UUID bruno = UUID.randomUUID();
    private PvpGame game;

    private static PvpGame.CardInfo card(String id, int fans, int style, int influence, int energy) {
        return new PvpGame.CardInfo(id, id, "rare", null, "original", true,
                Map.of("fans", fans, "style", style, "influence", influence, "energy", energy));
    }

    private static final List<PvpGame.CardInfo> STRONG = List.of(
            card("s1", 90, 90, 90, 90), card("s2", 85, 85, 85, 85), card("s3", 80, 80, 80, 80));
    private static final List<PvpGame.CardInfo> WEAK = List.of(
            card("w1", 60, 60, 60, 60), card("w2", 55, 55, 55, 55), card("w3", 70, 70, 70, 70));

    @BeforeEach
    void setUp() {
        game = new PvpGame(anna, "anna", bruno, "bruno", new Random(42));
    }

    @Test
    @DisplayName("La partita parte solo quando entrambe le squadre sono pronte")
    void startsWhenBothTeamsReady() {
        assertFalse(game.setTeam(anna, STRONG));
        assertEquals(PvpGame.Phase.TEAM, game.phase());
        assertTrue(game.setTeam(bruno, WEAK));
        assertEquals(PvpGame.Phase.CATEGORY, game.phase(), "il primo round lo sceglie lo sfidante");
        assertEquals(anna, game.chooser());
    }

    @Test
    @DisplayName("Solo chi deve scegliere puo' scegliere la categoria, e solo fra quelle valide")
    void categoryPermissions() {
        game.setTeam(anna, STRONG);
        game.setTeam(bruno, WEAK);

        assertFalse(game.chooseCategory(bruno, "fans"), "non tocca a Bruno");
        assertFalse(game.chooseCategory(anna, "hacking"), "categoria inesistente");
        assertTrue(game.chooseCategory(anna, "style"));
        assertEquals(PvpGame.Phase.CARDS, game.phase());
    }

    @Test
    @DisplayName("Round 1 sfidante, round 2 server, round 3 sfidato; vince chi fa piu' punti")
    void fullMatch() {
        game.setTeam(anna, STRONG);
        game.setTeam(bruno, WEAK);

        game.chooseCategory(anna, "fans");
        assertTrue(game.pickCard(anna, 0, false), "la prima scelta e' valida anche se l'altro non ha ancora scelto");
        assertFalse(game.bothPicked());
        assertTrue(game.pickCard(bruno, 2, false));
        assertTrue(game.bothPicked());
        PvpGame.RoundResult first = game.resolve();
        assertEquals(anna, first.winnerId());
        assertEquals(90, first.valueA());

        assertNull(game.chooser(), "il secondo round lo estrae il server");
        assertEquals(PvpGame.Phase.CARDS, game.phase());
        assertTrue(PvpGame.CATEGORIES.contains(game.category()));
        game.pickCard(anna, 1, false);
        game.pickCard(bruno, 0, false);
        game.resolve();

        assertEquals(bruno, game.chooser(), "il terzo round lo sceglie lo sfidato");
        game.chooseCategory(bruno, "energy");
        game.pickCard(anna, 2, false);
        game.pickCard(bruno, 1, false);
        game.resolve();

        assertEquals(PvpGame.Phase.ENDED, game.phase());
        assertEquals(3, game.a().score());
        assertEquals(anna, game.winner());
        assertEquals(3, game.history().size());
    }

    @Test
    @DisplayName("Il bonus +25% si usa una volta sola e puo' ribaltare un round")
    void boostOncePerMatch() {
        game.setTeam(anna, STRONG);
        game.setTeam(bruno, WEAK);
        game.chooseCategory(anna, "fans");

        game.pickCard(anna, 2, false);
        game.pickCard(bruno, 2, true);
        PvpGame.RoundResult round = game.resolve();
        assertEquals(88, round.valueB(), "70 * 1,25 arrotondato");
        assertEquals(bruno, round.winnerId(), "88 batte 80");

        assertFalse(game.pickCard(bruno, 0, true), "bonus gia' usato");
        game.pickCard(bruno, 0, false);
        assertTrue(game.hasPicked(bruno), "senza bonus la scelta e' valida");
    }

    @Test
    @DisplayName("Una carta gia' giocata non si rigioca, e non si sceglie due volte nello stesso round")
    void invalidPicks() {
        game.setTeam(anna, STRONG);
        game.setTeam(bruno, WEAK);
        game.chooseCategory(anna, "fans");

        game.pickCard(anna, 0, false);
        assertTrue(game.hasPicked(anna));
        assertFalse(game.pickCard(anna, 1, false), "gia' scelto in questo round");
        game.pickCard(bruno, 0, false);
        game.resolve();

        assertFalse(game.pickCard(anna, 0, false), "carta gia' giocata");
        assertFalse(game.pickCard(anna, 7, false), "indice fuori squadra");
    }

    @Test
    @DisplayName("Allo scadere del tempo il server gioca una carta ancora libera")
    void autoPicksUnusedCard() {
        game.setTeam(anna, STRONG);
        game.setTeam(bruno, WEAK);
        game.autoCategory();
        game.pickCard(anna, 0, false);
        game.autoPicks();
        PvpGame.RoundResult round = game.resolve();

        assertEquals("s1", round.cardA().id(), "la scelta fatta resta");
        assertFalse(round.boostB(), "il server non usa il bonus al posto tuo");
    }

    @Test
    @DisplayName("Non si risolve un round a meta'")
    void cannotResolveEarly() {
        game.setTeam(anna, STRONG);
        game.setTeam(bruno, WEAK);
        assertThrows(IllegalStateException.class, game::resolve);
    }

    @Test
    @DisplayName("Pareggio: nessun vincitore")
    void draw() {
        game.setTeam(anna, STRONG);
        game.setTeam(bruno, STRONG);
        game.chooseCategory(anna, "fans");
        game.pickCard(anna, 0, false);
        game.pickCard(bruno, 0, false);
        assertNull(game.resolve().winnerId());
    }
}
