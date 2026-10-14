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

    private final CardRepository cardRepository;
    private final ExternalCardSourceRepository sourceRepository;
    private final CardStatCalculator statCalculator;

    public CardImportWriter(CardRepository cardRepository, ExternalCardSourceRepository sourceRepository,
                            CardStatCalculator statCalculator) {
        this.cardRepository = cardRepository;
        this.sourceRepository = sourceRepository;
        this.statCalculator = statCalculator;
    }

    private CardImageAudit imageAudit;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setImageAudit(CardImageAudit imageAudit) {
        this.imageAudit = imageAudit;
    }

    /** Fonti le cui carte senza immagine le disegna il backend (FcCardArtController, NbaCardArtController). */
    private static final java.util.Set<String> DRAWN_BY_BACKEND = java.util.Set.of("fc27", "nba");

    @Transactional
    public int persist(String source, List<ImportedCard> cards, String errorMessage) {
        int imported = 0;
        // Immagini gia' viste rotte (CardImageAudit): le loro carte restano spente anche dopo l'import.
        java.util.Set<String> brokenImages = imageAudit == null ? java.util.Set.of() : imageAudit.brokenUrls();

        for (ImportedCard incoming : cards) {
            Card card = cardRepository.findBySourceAndExternalId(source, incoming.externalId())
                    .orElseGet(Card::new);

            // Le statistiche si calcolano solo per le carte nuove o ancora ai valori neutri di
            // prima: se un admin le ha ribilanciate dal pannello, un nuovo import non le sovrascrive.
            boolean computeStats = card.getId() == null || hasLegacyDefaultStats(card);
            if (card.getId() == null) {
                card.setSource(source);
                card.setExternalId(incoming.externalId());
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
            // precedente le aveva create attive, cosi' non escono mai dai pacchetti veri. Lo stesso
            // per le carte che la fonte pubblica senza immagine (molte promo giapponesi su
            // TCGplayer): nei pacchetti e nei set si vedrebbe solo un riquadro vuoto. Fanno
            // eccezione le fonti che la carta la disegna il backend (FC 27, NBA).
            boolean hasImage = incoming.imgUrl() != null && !incoming.imgUrl().isBlank();
            card.setActive(!incoming.isDemo() && (hasImage || DRAWN_BY_BACKEND.contains(source))
                    && !(hasImage && brokenImages.contains(incoming.imgUrl())));

            if (computeStats) applyStats(card);

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

    /** Ricalcola le statistiche di una carta importata dai suoi dati attuali. */
    public void applyStats(Card card) {
        CardStatCalculator.Stats stats = statCalculator.calculate(new CardStatCalculator.Input(
                card.getSource(), card.getCode(), card.getName(), card.getSetName(), card.getRarity(),
                card.getMarketPrice(), card.getMetadata()));
        card.setFans(stats.fans());
        card.setStyle(stats.style());
        card.setInfluence(stats.influence());
        card.setEnergy(stats.energy());
    }

    /** Vero per le carte importate prima del calcolo delle statistiche: tutte e quattro a 50. */
    public static boolean hasLegacyDefaultStats(Card card) {
        int d = CardStatCalculator.LEGACY_DEFAULT_STAT;
        return card.getFans() == d && card.getStyle() == d && card.getInfluence() == d && card.getEnergy() == d;
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
