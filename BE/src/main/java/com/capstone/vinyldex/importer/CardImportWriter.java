package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.ExternalCardSource;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.ExternalCardSourceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;

/**
 * Salvataggio delle carte importate, uguale per tutte le fonti.
 *
 * Aggiorna la carta se la coppia (source, externalId) esiste gia', altrimenti la crea.
 * Registra poi l'esito in external_card_sources.
 */
@Service
public class CardImportWriter {

    /** Stat di partenza delle carte importate: neutre, un admin puo' bilanciarle dal pannello. */
    private static final int DEFAULT_STAT = 50;

    private final CardRepository cardRepository;
    private final ExternalCardSourceRepository sourceRepository;

    public CardImportWriter(CardRepository cardRepository, ExternalCardSourceRepository sourceRepository) {
        this.cardRepository = cardRepository;
        this.sourceRepository = sourceRepository;
    }

    @Transactional
    public int persist(String source, List<ImportedCard> cards, String errorMessage) {
        int imported = 0;

        for (ImportedCard incoming : cards) {
            Card card = cardRepository.findBySourceAndExternalId(source, incoming.externalId())
                    .orElseGet(Card::new);

            if (card.getId() == null) {
                card.setSource(source);
                card.setExternalId(incoming.externalId());
                card.setFans(DEFAULT_STAT);
                card.setStyle(DEFAULT_STAT);
                card.setInfluence(DEFAULT_STAT);
                card.setEnergy(DEFAULT_STAT);
            }

            card.setCode(incoming.code());
            card.setName(incoming.name());
            card.setRarity(incoming.rarity());
            card.setImgUrl(incoming.imgUrl());
            card.setDescription(truncate(incoming.description(), 4000));
            card.setSetName(incoming.setName());
            card.setSetCode(incoming.setCode());
            card.setNumber(incoming.number());
            card.setMetadata(incoming.metadata() != null ? incoming.metadata() : new HashMap<>());

            // Le carte importate mostrano l'artwork esterno a piena pagina, come le originali fullImage.
            card.setFullImage(true);

            // Le carte demo non hanno un'immagine reale: restano disattivate anche se una richiesta
            // precedente le aveva create attive, cosi' non escono mai dai pacchetti veri.
            card.setActive(!incoming.isDemo());

            cardRepository.save(card);
            imported++;
        }

        ExternalCardSource sourceRow = sourceRepository.findBySource(source)
                .orElseGet(() -> new ExternalCardSource(source));
        sourceRow.setLastImportedAt(Instant.now());
        sourceRow.setTotalImported(sourceRow.getTotalImported() + imported);
        sourceRow.setLastError(truncate(errorMessage, 2000));
        sourceRepository.save(sourceRow);

        return imported;
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
