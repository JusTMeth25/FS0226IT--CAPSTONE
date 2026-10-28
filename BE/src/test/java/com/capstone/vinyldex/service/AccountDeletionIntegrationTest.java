package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.AuthRequests;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** "Elimina account": conferme richieste e cancellazione di tutti i dati, anche quelli senza cascade. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class AccountDeletionIntegrationTest {

    @Autowired
    private AccountDeletionService deletion;
    @Autowired
    private AuthService auth;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID register(String prefix) {
        String name = prefix + UUID.randomUUID().toString().substring(0, 8);
        auth.register(new AuthRequests.RegisterRequest(name, name + "@test.local", "Password123!"));
        return users.findByEmailIgnoreCase(name + "@test.local").orElseThrow().getId();
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    @Test
    @DisplayName("Username e password sbagliati rifiutati; poi via utente, carte, mercato e scambi")
    void deletesEverything() {
        UUID id = register("del_");
        UUID other = register("dlo_");
        String name = users.findById(id).orElseThrow().getUsername();
        try {
            UUID card = jdbc.queryForObject("select id from cards limit 1", UUID.class);
            jdbc.update("insert into user_cards (id, user_id, card_id, quantity) values (gen_random_uuid(), ?, ?, 1)", id, card);
            jdbc.update("insert into market_listings (id, seller_id, card_id, quantity, price_per_unit, status) values (gen_random_uuid(), ?, ?, 1, 10, 'ACTIVE')", id, card);
            UUID trade = UUID.randomUUID();
            jdbc.update("insert into trades (id, from_user_id, to_user_id, status) values (?, ?, ?, 'PENDING')", trade, other, id);
            jdbc.update("insert into trade_items (id, trade_id, card_id, quantity, direction) values (gen_random_uuid(), ?, ?, 1, 'REQUESTED')", trade, card);

            ApiException wrongName = assertThrows(ApiException.class, () -> deletion.delete(id, name + "x", "Password123!", null));
            assertEquals("delete_username_mismatch", wrongName.getMessage());
            ApiException wrongPass = assertThrows(ApiException.class, () -> deletion.delete(id, name, "Sbagliata123!", null));
            assertEquals("invalid_password", wrongPass.getMessage());
            assertTrue(users.existsById(id), "dopo un errore l'account resta");

            deletion.delete(id, name, "Password123!", null);

            assertFalse(users.existsById(id));
            assertEquals(0, count("select count(*) from user_cards where user_id = ?", id));
            assertEquals(0, count("select count(*) from market_listings where seller_id = ?", id));
            assertEquals(0, count("select count(*) from trades where id = ?", trade));
            assertTrue(users.existsById(other), "l'altro giocatore resta");
        } finally {
            jdbc.update("delete from trade_items where trade_id in (select id from trades where from_user_id in (?, ?) or to_user_id in (?, ?))", id, other, id, other);
            jdbc.update("delete from trades where from_user_id in (?, ?) or to_user_id in (?, ?)", id, other, id, other);
            jdbc.update("delete from market_listings where seller_id = ?", id);
            for (String table : new String[]{"user_wallet_transactions", "user_missions", "user_pack_credits", "user_cards"}) {
                jdbc.update("delete from " + table + " where user_id in (?, ?)", id, other);
            }
            jdbc.update("delete from users where id in (?, ?)", id, other);
        }
    }

    @Test
    @DisplayName("Dal pannello admin: serve lo username, mai se stessi, un altro admin o un NPC")
    void adminDeletes() {
        UUID admin = register("dla_");
        UUID target = register("dlt_");
        UUID otherAdmin = register("dlb_");
        try {
            jdbc.update("update users set role = 'ADMIN' where id in (?, ?)", admin, otherAdmin);
            String name = users.findById(target).orElseThrow().getUsername();
            String adminName = users.findById(otherAdmin).orElseThrow().getUsername();
            UUID npc = jdbc.queryForObject("select id from users where is_npc limit 1", UUID.class);
            String npcName = users.findById(npc).orElseThrow().getUsername();

            assertEquals("cannot_delete_self", assertThrows(ApiException.class, () -> deletion.deleteByAdmin(admin, admin, "x")).getMessage());
            assertEquals("admin_cannot_delete", assertThrows(ApiException.class, () -> deletion.deleteByAdmin(admin, otherAdmin, adminName)).getMessage());
            assertEquals("npc_cannot_delete", assertThrows(ApiException.class, () -> deletion.deleteByAdmin(admin, npc, npcName)).getMessage());
            assertEquals("delete_username_mismatch", assertThrows(ApiException.class, () -> deletion.deleteByAdmin(admin, target, "altro")).getMessage());
            assertTrue(users.existsById(target));

            deletion.deleteByAdmin(admin, target, name);
            assertFalse(users.existsById(target));
            assertTrue(users.existsById(npc), "l'NPC resta");
        } finally {
            for (String table : new String[]{"user_wallet_transactions", "user_missions", "user_pack_credits", "user_cards"}) {
                jdbc.update("delete from " + table + " where user_id in (?, ?, ?)", admin, target, otherAdmin);
            }
            jdbc.update("delete from users where id in (?, ?, ?)", admin, target, otherAdmin);
        }
    }
}
