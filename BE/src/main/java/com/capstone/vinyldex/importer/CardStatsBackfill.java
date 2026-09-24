package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.repository.CardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Assegna le statistiche calcolate alle carte importate prima che esistesse CardStatCalculator.
 *
 * Quelle carte sono rimaste ai quattro 50 neutri dell'import. Il passaggio gira a ogni avvio ma
 * tocca solo le carte ancora in quello stato, quindi dopo la prima volta non fa nulla, e non
 * sovrascrive mai statistiche ribilanciate a mano da un admin.
 */
@Component
public class CardStatsBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CardStatsBackfill.class);

    private final CardRepository cardRepository;
    private final CardImportWriter writer;

    public CardStatsBackfill(CardRepository cardRepository, CardImportWriter writer) {
        this.cardRepository = cardRepository;
        this.writer = writer;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int d = CardStatCalculator.LEGACY_DEFAULT_STAT;
        List<Card> cards = cardRepository.findBySourceNotAndFansAndStyleAndInfluenceAndEnergy("original", d, d, d, d);
        if (cards.isEmpty()) return;

        cards.forEach(writer::applyStats);
        cardRepository.saveAll(cards);
        log.info("Statistiche calcolate per {} carte importate", cards.size());
    }
}
