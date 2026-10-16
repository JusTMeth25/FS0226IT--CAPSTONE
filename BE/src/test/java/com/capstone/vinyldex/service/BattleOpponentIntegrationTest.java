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

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Squadra di un altro giocatore per le battaglie della pagina Battaglie. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class BattleOpponentIntegrationTest {

    @Autowired
    private BattleOpponentService opponents;
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
        return users.saveAndFlush(u).getId();
    }

    private List<String> give(UUID userId, int n) {
        return jdbc.queryForList("""
                INSERT INTO user_cards (id, user_id, card_id, obtained_at, quantity)
                SELECT gen_random_uuid(), ?, id, now(), 1 FROM (
                    SELECT id FROM cards WHERE is_active AND NOT holo AND code NOT LIKE 'legendary-ultimate-%' ORDER BY code LIMIT ?
                ) c
                RETURNING (SELECT code FROM cards WHERE cards.id = card_id)""", String.class, userId, n);
    }

    @Test
    @DisplayName("Squadra salvata se ce l'ha ancora, altrimenti le tre carte piu' forti; mai contro se stessi")
    @SuppressWarnings("unchecked")
    void opponentTeam() {
        UUID me = user("bom");
        UUID rival = user("bor");
        try {
            List<String> codes = give(rival, 6);
            Map<String, Object> best = opponents.team(me, rival);
            assertEquals("best", best.get("source"));
            assertEquals(3, ((List<?>) best.get("team")).size());

            jdbc.update("INSERT INTO user_battle_teams (user_id, name, cards) VALUES (?, 'Prova', ?)",
                    rival, String.join(",", codes.subList(3, 6)));
            Map<String, Object> saved = opponents.team(me, rival);
            assertEquals("saved", saved.get("source"));
            List<Object> team = (List<Object>) saved.get("team");
            assertEquals(3, team.size());

            assertThrows(ApiException.class, () -> opponents.team(me, me));
            assertThrows(ApiException.class, () -> opponents.team(rival, user("bon")), "chi non ha carte non ha squadra");
        } finally {
            jdbc.update("DELETE FROM user_battle_teams WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'bo%@test.local')");
            jdbc.update("DELETE FROM card_first_editions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'bo%@test.local')");
            jdbc.update("DELETE FROM user_cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'bo%@test.local')");
            jdbc.update("DELETE FROM users WHERE email LIKE 'bo%@test.local'");
        }
    }
}
