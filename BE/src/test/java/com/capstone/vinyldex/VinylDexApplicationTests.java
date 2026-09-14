package com.capstone.vinyldex;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Avvio completo del contesto.
 *
 * Richiede un Postgres raggiungibile, perche' Flyway e la validazione dello schema di Hibernate
 * partono all'avvio. Senza database il test viene saltato invece di fallire: cosi' "mvn test"
 * resta verde su una macchina pulita e chi vuole la verifica vera imposta DB_PASSWORD.
 */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "DB_PASSWORD", matches = ".+")
class VinylDexApplicationTests {

    @Test
    void contextLoads() {
    }
}
