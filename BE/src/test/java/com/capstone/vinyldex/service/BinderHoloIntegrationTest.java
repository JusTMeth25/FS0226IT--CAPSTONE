package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.CollectionEntryDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Nel raccoglitore l'olografica ha la sua tasca, subito dopo quella della carta normale. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class BinderHoloIntegrationTest {

    @Autowired
    private CollectionService collection;
    @Autowired
    private HoloCardService holoCards;
    @Autowired
    private UserCardService userCards;
    @Autowired
    private UserRepository users;
    @Autowired
    private CardRepository cards;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private TransactionTemplate tx;

    private User user() {
        String name = "bnd_" + UUID.randomUUID().toString().substring(0, 8);
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@test.local");
        u.setPasswordHash("x");
        return users.saveAndFlush(u);
    }

    private int indexOf(List<CollectionEntryDto> pockets, String code) {
        for (int i = 0; i < pockets.size(); i++) if (pockets.get(i).id().equals(code)) return i;
        return -1;
    }

    @Test
    @DisplayName("Carta normale e olografica si vedono tutte e due; il completamento conta la carta una volta")
    void normalAndHolo() {
        UUID id = user().getId();
        try {
            Card base = cards.findByCode("court-common-004").orElseThrow();
            Card holo = tx.execute(s -> holoCards.holoOf(base));
            tx.executeWithoutResult(s -> {
                User u = users.findById(id).orElseThrow();
                userCards.add(u, base, 1);
                userCards.add(u, holo, 1);
            });
            CollectionService.BinderPage page = collection.binder(id, "original", null, 0, CollectionService.BINDER_MAX_LIMIT);
            List<CollectionEntryDto> pockets = page.cards();
            int at = indexOf(pockets, base.getCode());
            assertTrue(at >= 0, "c'e' la carta normale");
            assertTrue(pockets.get(at).owned());
            assertEquals(holo.getCode(), pockets.get(at + 1).id(), "l'olografica subito dopo");
            assertTrue(pockets.get(at + 1).owned());
            assertTrue(pockets.get(at + 1).foil() > 0, "l'olografica brilla");
            assertEquals(page.cardsTotal() + 1, page.total(), "una tasca in piu'");
            assertEquals(1, page.owned());

            // Le pagine si sfogliano anche a cavallo delle due tasche.
            CollectionService.BinderPage next = collection.binder(id, "original", null, at + 1, 1);
            assertEquals(holo.getCode(), next.cards().getFirst().id());

            // Solo l'olografica: la carta normale resta da trovare.
            jdbc.update("delete from user_cards where user_id = ? and card_id = ?", id, base.getId());
            List<CollectionEntryDto> onlyHolo = collection.binder(id, "original", null, 0, CollectionService.BINDER_MAX_LIMIT).cards();
            int baseAt = indexOf(onlyHolo, base.getCode());
            assertFalse(onlyHolo.get(baseAt).owned());
            assertTrue(onlyHolo.get(baseAt + 1).owned());
        } finally {
            jdbc.update("delete from card_first_editions where user_id = ?", id);
            jdbc.update("delete from user_cards where user_id = ?", id);
            jdbc.update("delete from users where id = ?", id);
        }
    }
}
