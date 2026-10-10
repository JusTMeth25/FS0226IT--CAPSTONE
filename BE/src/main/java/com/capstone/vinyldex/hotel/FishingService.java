package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.UserCardService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Pesca dal molo della spiaggia: i pesci rari (punteggio alto) portano una carta, fino a tre al
 * giorno. Piu' e' grosso il pesce, piu' e' facile che la carta sia rara.
 */
@Service
public class FishingService {

    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    /** Punteggio da cui il pesce e' "raro" e porta una carta. */
    static final int RARE_FISH = 70;
    static final int CARDS_PER_DAY = 3;

    private final JdbcTemplate jdbc;
    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final UserCardService userCardService;
    private final Random random = new Random();

    public FishingService(JdbcTemplate jdbc, CardRepository cardRepository, UserRepository userRepository,
                          UserCardService userCardService) {
        this.jdbc = jdbc;
        this.cardRepository = cardRepository;
        this.userRepository = userRepository;
        this.userCardService = userCardService;
    }

    /** Rarita' della carta pescata: sopra i 95 punti puo' uscire un'epica. */
    static String rarityFor(int score, Random random) {
        int roll = random.nextInt(100);
        if (score >= 95 && roll < 15) return "epic";
        if (score >= 85 && roll < 40) return "rare";
        return roll < 50 ? "uncommon" : "common";
    }

    /** La carta pescata con un pesce raro, o null (pesce normale o limite del giorno raggiunto). */
    @Transactional
    public Card catchCard(UUID userId, int score) {
        if (score < RARE_FISH) return null;
        LocalDate today = LocalDate.now(ZONE);
        Integer caught = jdbc.queryForObject("SELECT count(*) FROM fishing_catches WHERE user_id = ? AND caught_on = ?",
                Integer.class, userId, Date.valueOf(today));
        if (caught != null && caught >= CARDS_PER_DAY) return null;
        String rarity = rarityFor(score, random);
        List<Card> pool = cardRepository.findAllActiveWithArtistClass().stream()
                .filter(c -> !c.isUltimate() && rarity.equals(c.getRarity()) && c.getImgUrl() != null && !c.getImgUrl().isBlank())
                .toList();
        if (pool.isEmpty()) return null;
        Card card = pool.get(random.nextInt(pool.size()));
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return null;
        userCardService.add(user, card, 1);
        jdbc.update("INSERT INTO fishing_catches (user_id, card_id, score, caught_on) VALUES (?, ?, ?, ?)",
                userId, card.getId(), score, Date.valueOf(today));
        return card;
    }

    public int leftToday(UUID userId) {
        Integer caught = jdbc.queryForObject("SELECT count(*) FROM fishing_catches WHERE user_id = ? AND caught_on = ?",
                Integer.class, userId, Date.valueOf(LocalDate.now(ZONE)));
        return Math.max(0, CARDS_PER_DAY - (caught == null ? 0 : caught));
    }
}
