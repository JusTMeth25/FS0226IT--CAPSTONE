package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.GameRequests;
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

import static org.junit.jupiter.api.Assertions.*;

/** Chi e' impegnato (qui: in una battaglia contro gli NPC) non riceve proposte di scambio. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class TradeBusyIntegrationTest {

    @Autowired
    private TradeService trades;
    @Autowired
    private UserActivity activity;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;

    private User user(String prefix) {
        String name = prefix + "_" + UUID.randomUUID().toString().substring(0, 8);
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@test.local");
        u.setPasswordHash("x");
        u.setGold(1000);
        return users.saveAndFlush(u);
    }

    @Test
    @DisplayName("Proposta a chi e' in battaglia: rifiutata con recipient_busy; finita la battaglia arriva")
    void busyRecipient() {
        User anna = user("tba");
        User beppe = user("tbb");
        GameRequests.TradeCreateRequest request = new GameRequests.TradeCreateRequest(beppe.getUsername(), null, null, 10, 0);
        try {
            activity.setInBattle(beppe.getId(), true);
            assertTrue(activity.isBusy(beppe.getId()));
            ApiException ex = assertThrows(ApiException.class, () -> trades.create(anna.getId(), request));
            assertEquals("recipient_busy", ex.getCode());

            activity.setInBattle(beppe.getId(), false);
            assertFalse(activity.isBusy(beppe.getId()));
            assertNotNull(trades.create(anna.getId(), request).id());
        } finally {
            activity.setInBattle(beppe.getId(), false);
            jdbc.update("DELETE FROM trade_items WHERE trade_id IN (SELECT id FROM trades WHERE from_user_id = ?)", anna.getId());
            jdbc.update("DELETE FROM trades WHERE from_user_id = ?", anna.getId());
            jdbc.update("DELETE FROM user_wallet_transactions WHERE user_id IN (?, ?)", anna.getId(), beppe.getId());
            jdbc.update("DELETE FROM users WHERE id IN (?, ?)", anna.getId(), beppe.getId());
        }
    }
}
