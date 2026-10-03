package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.ArtistClass;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.repository.CardRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

/**
 * Versioni olografiche delle carte.
 *
 * Un'olografica non e' una copia speciale della carta normale ma una carta a se': codice
 * "<codice>-holo", nome "(Olografica)", stessa immagine e statistiche, prezzo di mercato
 * PRICE_MULTIPLIER volte quello della carta base. Cosi' trovarla, comprarla, scambiarla, regalarla
 * o venderla non tocca mai la carta normale gia' in collezione, e vale di piu'.
 *
 * Si crea la prima volta che serve (quando esce da un pacchetto). Non entra nel catalogo in cache
 * (CardRepository esclude holo = true): non esce dai pacchetti come carta normale e non allunga
 * raccoglitori e set. Si salva con l'EntityManager e non con CardRepository.save, che svuoterebbe
 * la cache dell'intero catalogo.
 */
@Service
public class HoloCardService {

    /** Quanto vale un'olografica rispetto alla carta normale. */
    public static final double PRICE_MULTIPLIER = 3.0;

    private final CardRepository cardRepository;
    private final EntityManager entityManager;

    public HoloCardService(CardRepository cardRepository, EntityManager entityManager) {
        this.cardRepository = cardRepository;
        this.entityManager = entityManager;
    }

    /** Prezzo dell'olografica dato quello della carta base (null se la base non ha prezzo). */
    public static Double holoPrice(Double basePrice) {
        return basePrice == null ? null : Math.round(basePrice * PRICE_MULTIPLIER * 100) / 100.0;
    }

    /** La versione olografica della carta, creata la prima volta. */
    @Transactional
    public Card holoOf(Card base) {
        if (base.isHolo()) return base;
        String code = base.getCode() + Card.HOLO_SUFFIX;
        return cardRepository.findByCode(code).orElseGet(() -> create(base, code));
    }

    private Card create(Card base, String code) {
        Card holo = new Card();
        holo.setCode(code);
        holo.setHolo(true);
        holo.setName(base.getName() + " (Olografica)");
        // La carta base puo' arrivare dalla cache (staccata dalla sessione): si collega la classe per id.
        if (base.getArtistClass() != null) {
            holo.setArtistClass(entityManager.getReference(ArtistClass.class, base.getArtistClass().getId()));
        }
        holo.setVariant(base.getVariant());
        holo.setGroup(base.getGroup());
        holo.setRarity(base.getRarity());
        holo.setImgUrl(base.getImgUrl());
        holo.setFullImage(base.isFullImage());
        holo.setFans(base.getFans());
        holo.setStyle(base.getStyle());
        holo.setInfluence(base.getInfluence());
        holo.setEnergy(base.getEnergy());
        holo.setDescription(base.getDescription());
        holo.setActive(true);
        holo.setSource(base.getSource());
        holo.setSetName(base.getSetName());
        holo.setSetCode(base.getSetCode());
        holo.setNumber(base.getNumber());
        Map<String, Object> metadata = new HashMap<>(base.getMetadata() == null ? Map.of() : base.getMetadata());
        metadata.put("holo", true);
        metadata.put("baseCode", base.getCode());
        Double price = holoPrice(base.getMarketPrice());
        if (price != null) metadata.put("marketPrice", price);
        holo.setMetadata(metadata);
        entityManager.persist(holo);
        return holo;
    }
}
