package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Asta con tre offerenti sul database vero: i gold bloccati, il rimborso a chi viene superato,
 * la carta al vincitore alla chiusura, l'annullamento dell'admin.
 */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
class AuctionIntegrationTest {

    @Autowired
    private AuctionService auctions;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CardRepository cardRepository;
    @Autowired
    private UserCardRepository userCardRepository;
    @Autowired
    private JdbcTemplate jdbc;

    private final List<UUID> users = new ArrayList<>();

    private UUID bidder(String prefix) {
        String name = prefix + "_" + UUID.randomUUID().toString().substring(0, 6);
        User user = new User();
        user.setUsername(name);
        user.setEmail(name + "@test.local");
        user.setPasswordHash("x");
        user.setGold(1000);
        user = userRepository.save(user);
        users.add(user.getId());
        return user.getId();
    }

    private int gold(UUID id) {
        return userRepository.findById(id).orElseThrow().getGold();
    }

    @BeforeEach
    void closeOpenAuctions() {
        // Un'asta aperta dal ciclo automatico del server si chiude, per partire puliti.
        jdbc.update("UPDATE hotel_auctions SET status = 'UNSOLD' WHERE status = 'OPEN'");
    }

    @AfterEach
    void cleanUp() {
        for (UUID id : users) {
            jdbc.update("UPDATE hotel_auctions SET bidder_id = NULL WHERE bidder_id = ?", id);
            jdbc.update("DELETE FROM user_wallet_transactions WHERE user_id = ?", id);
            jdbc.update("DELETE FROM user_cards WHERE user_id = ?", id);
            userRepository.deleteById(id);
        }
    }

    @Test
    @DisplayName("Tre offerenti: chi viene superato riavra' i gold, il vincitore paga e riceve la carta")
    void threeBidders() {
        Card card = cardRepository.findAllActiveWithArtistClass().stream()
                .filter(c -> "rare".equals(c.getRarity())).findFirst().orElseThrow();
        Map<String, Object> view = auctions.startNow(card.getCode(), 100, 5);
        @SuppressWarnings("unchecked")
        Map<String, Object> lot = (Map<String, Object>) view.get("lot");
        assertEquals(100, lot.get("minimumBid"));

        UUID anna = bidder("anna");
        UUID bruno = bidder("bruno");
        UUID carla = bidder("carla");
        auctions.bid(anna, 100);
        assertEquals(900, gold(anna), "gold bloccati");
        assertThrows(ApiException.class, () -> auctions.bid(bruno, 101), "rilancio troppo basso");
        auctions.bid(bruno, 105);
        assertEquals(1000, gold(anna), "superata: gold restituiti");
        assertThrows(ApiException.class, () -> auctions.bid(bruno, 200), "gia' in testa");
        auctions.bid(carla, 150);
        assertEquals(1000, gold(bruno));
        assertEquals(850, gold(carla));

        jdbc.update("UPDATE hotel_auctions SET ends_at = now() - interval '1 second' WHERE status = 'OPEN'");
        auctions.closeExpired();
        assertTrue(userCardRepository.findByUserIdAndCardId(carla, card.getId()).isPresent(), "la carta va al vincitore");
        assertFalse(userCardRepository.findByUserIdAndCardId(anna, card.getId()).isPresent());
        assertEquals(850, gold(carla));
    }

    @Test
    @DisplayName("L'admin annulla l'asta: chi era in testa riavra' i gold")
    void cancel() {
        Card card = cardRepository.findAllActiveWithArtistClass().stream()
                .filter(c -> "epic".equals(c.getRarity())).findFirst().orElseThrow();
        auctions.startNow(card.getCode(), 50, 5);
        UUID anna = bidder("anna");
        auctions.bid(anna, 80);
        assertEquals(920, gold(anna));
        auctions.cancel();
        assertEquals(1000, gold(anna));
        assertThrows(ApiException.class, () -> auctions.bid(anna, 100), "asta chiusa");
    }
}
