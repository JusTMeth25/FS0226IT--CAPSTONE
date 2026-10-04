package com.capstone.vinyldex.service;

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

import java.sql.Timestamp;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Un doppione appena trovato deve risalire fra le "ultime pescate": la data di ottenimento
 * della carta si sposta a ogni copia nuova (prima restava quella della prima copia).
 */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class UserCardObtainedIntegrationTest {

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

    @Test
    @DisplayName("Una copia in piu' aggiorna la data di ottenimento")
    void duplicateMovesObtainedAt() {
        String name = "obt_" + UUID.randomUUID().toString().substring(0, 8);
        User user = new User();
        user.setUsername(name);
        user.setEmail(name + "@test.local");
        user.setPasswordHash("x");
        UUID userId = users.saveAndFlush(user).getId();
        try {
            UUID cardId = jdbc.queryForObject("select id from cards where is_active limit 1", UUID.class);
            Card card = cards.findById(cardId).orElseThrow();
            tx.executeWithoutResult(s -> userCards.add(users.findById(userId).orElseThrow(), card, 1));
            // La prima copia "un'ora fa".
            jdbc.update("update user_cards set obtained_at = now() - interval '1 hour' where user_id = ?", userId);
            Timestamp before = jdbc.queryForObject("select obtained_at from user_cards where user_id = ?", Timestamp.class, userId);
            tx.executeWithoutResult(s -> userCards.add(users.findById(userId).orElseThrow(), card, 1));
            Timestamp after = jdbc.queryForObject("select obtained_at from user_cards where user_id = ?", Timestamp.class, userId);
            assertEquals(2, jdbc.queryForObject("select quantity from user_cards where user_id = ?", Integer.class, userId));
            assertTrue(after.toInstant().isAfter(before.toInstant().plusSeconds(3000)), before + " -> " + after);
        } finally {
            jdbc.update("delete from user_cards where user_id = ?", userId);
            jdbc.update("delete from users where id = ?", userId);
        }
    }
}
