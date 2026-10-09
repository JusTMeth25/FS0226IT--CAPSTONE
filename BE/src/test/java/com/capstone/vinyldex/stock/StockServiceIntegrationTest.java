package com.capstone.vinyldex.stock;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Compravendita vera sul database: gold, commissione, azioni possedute e guadagno. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class StockServiceIntegrationTest {

    @Autowired
    private StockService stocks;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("Si comprano azioni coi gold, si rivendono, la commissione resta al mercato")
    @SuppressWarnings("unchecked")
    void buyAndSell() {
        String name = "stk_" + UUID.randomUUID().toString().substring(0, 8);
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@test.local");
        u.setPasswordHash("x");
        u.setGold(100_000);
        UUID id = users.saveAndFlush(u).getId();
        try {
            Map<String, Object> view = stocks.view(id);
            List<Map<String, Object>> list = (List<Map<String, Object>>) view.get("stocks");
            assertEquals(StockMarket.LISTINGS.size(), list.size());
            assertFalse(((List<?>) list.getFirst().get("spark")).isEmpty());

            Map<String, Object> bought = stocks.trade(id, "PKMN", "buy", 10);
            Map<String, Object> done = (Map<String, Object>) bought.get("done");
            long total = ((Number) done.get("total")).longValue();
            long fee = ((Number) done.get("fee")).longValue();
            assertEquals(100_000 - total - fee, users.findById(id).orElseThrow().getGold());
            List<Map<String, Object>> portfolio = (List<Map<String, Object>>) bought.get("portfolio");
            assertEquals(10, portfolio.getFirst().get("shares"));

            assertThrows(ApiException.class, () -> stocks.trade(id, "PKMN", "sell", 11), "non si vende quello che non si ha");
            assertThrows(ApiException.class, () -> stocks.trade(id, "NOPE", "buy", 1));

            stocks.trade(id, "PKMN", "sell", 10);
            int gold = users.findById(id).orElseThrow().getGold();
            assertTrue(gold < 100_000 && gold > 100_000 - 4 * (total * 0.02 + fee + 2), "solo commissioni e oscillazione: " + gold);
            assertTrue(stocks.portfolio(id).isEmpty());
            Map<String, Object> history = stocks.history("PKMN", "1h");
            assertFalse(((List<?>) history.get("points")).isEmpty());
        } finally {
            jdbc.update("delete from user_stocks where user_id = ?", id);
            jdbc.update("delete from user_wallet_transactions where user_id = ?", id);
            jdbc.update("delete from users where id = ?", id);
        }
    }
}
