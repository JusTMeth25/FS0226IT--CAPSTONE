package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Scambi fra giocatori: al massimo 5 conclusi ogni mezz'ora, per entrambi i giocatori. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class TradeLimitIntegrationTest {

    @Autowired
    private TradeService trades;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID user(String prefix) {
        String name = prefix + "_" + UUID.randomUUID().toString().substring(0, 8);
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@test.local");
        u.setPasswordHash("x");
        u.setGold(1000);
        return users.saveAndFlush(u).getId();
    }

    private UUID trade(UUID from, UUID to, String status, String age) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO trades (id, from_user_id, to_user_id, status, offered_gold, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, 0, now() - CAST(? AS interval), now() - CAST(? AS interval))", id, from, to, status, age, age);
        return id;
    }

    @Test
    @DisplayName("Al sesto scambio in mezz'ora si aspetta; quelli piu' vecchi non contano")
    void fivePerHalfHour() {
        UUID anna = user("tla");
        UUID beppe = user("tlb");
        UUID carla = user("tlc");
        try {
            for (int i = 0; i < TradeLimits.PER_WINDOW; i++) trade(anna, carla, "ACCEPTED", "5 minutes");
            trade(anna, carla, "ACCEPTED", "40 minutes");

            // Beppe propone ad Anna: Anna ha gia' 5 scambi recenti.
            UUID toAnna = trade(beppe, anna, "PENDING", "1 minute");
            ApiException mine = assertThrows(ApiException.class, () -> trades.accept(anna, toAnna));
            assertEquals("trade_limit", mine.getMessage());

            // Anna propone a Beppe: e' lei, la proponente, a non poter concludere.
            UUID toBeppe = trade(anna, beppe, "PENDING", "1 minute");
            ApiException other = assertThrows(ApiException.class, () -> trades.accept(beppe, toBeppe));
            assertEquals("trade_limit_other", other.getMessage());

            // Fra Beppe e Carla (Carla ha 6 scambi ma 5 recenti): bloccato anche lui per Carla.
            UUID toCarla = trade(beppe, carla, "PENDING", "1 minute");
            assertThrows(ApiException.class, () -> trades.accept(carla, toCarla));

            // Fuori dalla finestra gli scambi non contano: Beppe e un giocatore nuovo scambiano.
            UUID dario = user("tld");
            UUID ok = trade(beppe, dario, "PENDING", "1 minute");
            assertEquals("ACCEPTED", trades.accept(dario, ok).status().toString().toUpperCase());
        } finally {
            jdbc.update("DELETE FROM trades WHERE from_user_id IN (SELECT id FROM users WHERE email LIKE 'tl%@test.local') "
                    + "OR to_user_id IN (SELECT id FROM users WHERE email LIKE 'tl%@test.local')");
            jdbc.update("DELETE FROM user_wallet_transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'tl%@test.local')");
            jdbc.update("DELETE FROM users WHERE email LIKE 'tl%@test.local'");
        }
    }
}
