package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.NpcFoundCardRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/** Le carte trovate dagli NPC finiscono nel database e restano nella vetrina anche dopo un riavvio. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
class NpcFoundCardsIntegrationTest {

    @Autowired
    private NpcDeals deals;
    @Autowired
    private CardRepository cardRepository;
    @Autowired
    private NpcFoundCardRepository foundRepository;
    @Autowired
    private PlatformTransactionManager transactionManager;

    private final UUID npc = UUID.randomUUID();

    @AfterEach
    void cleanUp() {
        foundRepository.deleteAll(foundRepository.findByNpcIdOrderByFoundAtDesc(npc));
    }

    @Test
    @DisplayName("Anche dentro una transazione di sola lettura (l'apertura del pacchetto) la carta trovata si salva")
    void savedFromReadOnlyTransaction() {
        List<Card> cards = cardRepository.findAllActiveWithArtistClass().stream().limit(3).toList();
        assertFalse(cards.isEmpty(), "serve almeno una carta attiva nel database");

        TransactionTemplate readOnly = new TransactionTemplate(transactionManager);
        readOnly.setReadOnly(true);
        readOnly.executeWithoutResult(status -> deals.addFound(npc, cards));

        int expected = Math.min(2, cards.size());
        assertEquals(expected, foundRepository.findByNpcIdOrderByFoundAtDesc(npc).size());
        // Dalla tabella, non dalla memoria: e' quello che vede il server dopo un riavvio.
        assertEquals(expected, deals.found(npc).size());
        assertEquals(deals.found(npc).get(0).getId(), deals.showcase(npc).get(0).getId(), "in cima alla vetrina");
    }
}
