package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** L'admin regala carte dal pannello: anche le carte ultimate, che dai pacchetti non escono quasi mai. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class AdminGiveCardIntegrationTest {

    @Autowired
    private AdminService admin;
    @Autowired
    private UserRepository users;
    @Autowired
    private CardRepository cards;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("Le copie date si sommano a quelle che l'utente ha gia'")
    void giveCard() {
        String name = "give_" + UUID.randomUUID().toString().substring(0, 8);
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@test.local");
        u.setPasswordHash("x");
        UUID id = users.saveAndFlush(u).getId();
        try {
            Card empress = cards.findByCode(Card.ULTIMATE_PREFIX + "001").orElseThrow();
            Map<String, Object> first = admin.giveCard(id, empress.getId(), 1);
            assertEquals(1, first.get("quantity"));
            assertEquals(3, admin.giveCard(id, empress.getId(), 2).get("quantity"));
            assertEquals(3, jdbc.queryForObject("select quantity from user_cards where user_id = ? and card_id = ?",
                    Integer.class, id, empress.getId()));
            assertThrows(ApiException.class, () -> admin.giveCard(id, UUID.randomUUID(), 1));
            assertThrows(ApiException.class, () -> admin.giveCard(UUID.randomUUID(), empress.getId(), 1));
        } finally {
            jdbc.update("delete from card_first_editions where user_id = ?", id);
            jdbc.update("delete from user_cards where user_id = ?", id);
            jdbc.update("delete from users where id = ?", id);
        }
    }
}
