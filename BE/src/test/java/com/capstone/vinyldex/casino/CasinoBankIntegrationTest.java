package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserRole;
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

/**
 * Cassa del banco sul database vero: le puntate entrano, le vincite escono, e l'admin riscuote il
 * saldo fra le sue fiches. Alla fine si rimette la cassa com'era.
 */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class CasinoBankIntegrationTest {

    @Autowired
    private CasinoService casino;
    @Autowired
    private CasinoBank bank;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID user(String prefix, UserRole role, int chips) {
        String name = prefix + "_" + UUID.randomUUID().toString().substring(0, 8);
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@test.local");
        u.setPasswordHash("x");
        u.setRole(role);
        u.setCasinoChips(chips);
        return users.saveAndFlush(u).getId();
    }

    private long chipsBalance() {
        return jdbc.queryForObject("select balance from casino_bank where currency = 'CHIPS'", Long.class);
    }

    @Test
    @DisplayName("Puntate e vincite passano dalla cassa del banco, l'admin riscuote le fiches")
    void bankAndWithdraw() {
        UUID player = user("bankp", UserRole.USER, 1000);
        UUID admin = user("banka", UserRole.ADMIN, 0);
        long start = chipsBalance();
        try {
            casino.tableChips(player, -100);
            casino.tableChips(player, 30);
            assertEquals(start + 70, chipsBalance(), "il banco ha guadagnato 70 fiches");

            // Si svuota la cassa per provare la riscossione su un saldo noto.
            jdbc.update("update casino_bank set balance = 70 where currency = 'CHIPS'");
            bank.withdraw(admin, "chips", 50L);
            assertEquals(20, chipsBalance());
            assertEquals(50, users.findById(admin).orElseThrow().getCasinoChips());
            assertThrows(ApiException.class, () -> bank.withdraw(admin, "chips", 21L), "non si riscuote piu' del saldo");
            bank.withdraw(admin, "chips", null);
            assertEquals(0, chipsBalance(), "senza importo si riscuote tutto");
            assertEquals(70, users.findById(admin).orElseThrow().getCasinoChips());
            assertThrows(ApiException.class, () -> bank.withdraw(admin, "chips", null), "cassa vuota");
        } finally {
            jdbc.update("update casino_bank set balance = ?, earned = earned - 70, withdrawn = withdrawn - 70 where currency = 'CHIPS'", start);
            jdbc.update("delete from casino_bank_withdrawals where admin_id = ?", admin);
            jdbc.update("delete from users where id in (?, ?)", player, admin);
        }
    }
}
