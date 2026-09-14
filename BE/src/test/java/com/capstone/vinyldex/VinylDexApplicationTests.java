package com.capstone.vinyldex;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.boot.test.context.SpringBootTest;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Avvio completo del contesto.
 *
 * Richiede un Postgres raggiungibile, perche' Flyway e la validazione dello schema di Hibernate
 * partono all'avvio. Senza credenziali il test viene saltato invece di fallire, cosi' "mvn test"
 * resta verde anche su una macchina appena clonata.
 */
@SpringBootTest
@EnabledIf("credenzialiDatabasePresenti")
class VinylDexApplicationTests {

    /**
     * Le credenziali possono arrivare da BE/.env, che e' il modo normale in locale, oppure da
     * una variabile d'ambiente, come succede in CI. Controllare solo la variabile farebbe
     * saltare il test proprio sulla macchina che ha il database configurato.
     */
    static boolean credenzialiDatabasePresenti() {
        if (System.getenv("DB_PASSWORD") != null && !System.getenv("DB_PASSWORD").isBlank()) {
            return true;
        }
        Path envFile = Path.of(".env");
        return Files.isRegularFile(envFile);
    }

    @Test
    void contextLoads() {
    }
}
