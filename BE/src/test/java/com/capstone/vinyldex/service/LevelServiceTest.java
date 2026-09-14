package com.capstone.vinyldex.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * La formula dei livelli deve restare identica a frontend/src/utils/levelUtils.js.
 * I valori attesi qui sotto sono presi da quella implementazione.
 */
class LevelServiceTest {

    private final LevelService levelService = new LevelService();

    @Test
    @DisplayName("Un utente nuovo e' di livello 1")
    void startsAtLevelOne() {
        assertEquals(1, levelService.calcLevel(0));
    }

    @Test
    @DisplayName("Servono 100 XP per passare al livello 2")
    void firstLevelUpAtHundredXp() {
        assertEquals(1, levelService.calcLevel(99));
        assertEquals(2, levelService.calcLevel(100));
    }

    @Test
    @DisplayName("Il secondo livello costa 250 XP, quindi il terzo arriva a 350 totali")
    void secondLevelUpCosts250() {
        assertEquals(2, levelService.calcLevel(349));
        assertEquals(3, levelService.calcLevel(350));
    }

    @Test
    @DisplayName("Il livello si ferma a 51 anche con XP enormi")
    void capsAtMaxLevel() {
        assertEquals(51, levelService.calcLevel(Integer.MAX_VALUE));
    }

    @Test
    @DisplayName("I livelli multipli di 5 danno la ricompensa maggiore")
    void multiplesOfFiveRewardMost() {
        assertEquals(250, levelService.getLevelRewards(10).gold());
        assertEquals(80, levelService.getLevelRewards(8).gold());
        assertEquals(35, levelService.getLevelRewards(7).gold());
    }

    @Test
    @DisplayName("Solo alcuni livelli regalano un pacchetto")
    void packRewardsOnlyAtMilestones() {
        assertEquals("pack-deluxe", levelService.getLevelRewards(5).pack());
        assertEquals("pack-premium", levelService.getLevelRewards(10).pack());
        assertEquals("pack-premium", levelService.getLevelRewards(25).pack());
        assertNull(levelService.getLevelRewards(7).pack());
    }
}
