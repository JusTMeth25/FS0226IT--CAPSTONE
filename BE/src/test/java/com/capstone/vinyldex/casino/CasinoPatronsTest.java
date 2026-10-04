package com.capstone.vinyldex.casino;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CasinoPatronsTest {

    @Test
    @DisplayName("Gli NPC giocano con le regole vere: su tanti giri a ogni tavolo il banco guadagna")
    void houseWinsOnAverage() {
        Random random = new Random(5);
        for (String table : CasinoPatrons.TABLES) {
            long staked = 0;
            long returned = 0;
            for (int i = 0; i < 40_000; i++) {
                CasinoPatrons.Play play = CasinoPatrons.play(table, random);
                assertTrue(play.returned() >= 0, table + ": ritorno negativo");
                assertTrue(play.line() != null && !play.line().isBlank());
                staked += play.stake();
                returned += play.returned();
            }
            double rtp = (double) returned / staked;
            assertTrue(rtp > 0.80 && rtp < 1.0, table + " ritorno " + rtp);
        }
    }
}
