package com.capstone.vinyldex.service;

import org.springframework.stereotype.Service;

/**
 * Formula di livello e ricompense.
 *
 * Deve restare identica a frontend/src/utils/levelUtils.js: se le due divergono, il livello
 * mostrato in pagina non coincide con quello salvato e l'utente vede numeri che ballano.
 */
@Service
public class LevelService {

    private static final int MAX_LEVEL = 50;

    /** XP necessari per superare il livello indicato, contati a partire dall'inizio di quel livello. */
    private static int xpNeededFor(int level) {
        return level * 100 + (level - 1) * 50;
    }

    /** Livello corrispondente a un totale di XP accumulati. */
    public int calcLevel(int totalXp) {
        int remaining = totalXp;
        int level = 1;
        for (int lv = 1; lv <= MAX_LEVEL; lv++) {
            int needed = xpNeededFor(lv);
            if (remaining < needed) break;
            remaining -= needed;
            level = lv + 1;
        }
        return level;
    }

    /** Ricompense assegnate al raggiungimento di un livello. */
    public LevelRewards getLevelRewards(int level) {
        int gold;
        if (level % 5 == 0) {
            gold = level * 25;
        } else if (level % 2 == 0) {
            gold = level * 10;
        } else {
            gold = level * 5;
        }

        String pack = null;
        if (level == 5) {
            pack = "pack-deluxe";
        } else if (level == 10 || level == 25 || level == 50) {
            pack = "pack-premium";
        }

        return new LevelRewards(gold, pack);
    }

    public record LevelRewards(int gold, String pack) {
    }
}
