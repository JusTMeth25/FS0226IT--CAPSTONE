package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Pack;
import com.capstone.vinyldex.repository.CardRepository;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Estrazione delle carte di un pacchetto.
 *
 * Sempre e solo lato server: il client non decide ne' le probabilita' ne' le carte vinte.
 * Le carte di una stessa apertura sono tutte diverse fra loro.
 */
@Component
public class PackGenerator {

    /** Solo queste rarita' beneficiano del bonus di un evento attivo. */
    private static final Set<String> BOOSTED_RARITIES = Set.of("rare", "epic", "legendary");

    /** Le garanzie si soddisfano dalla piu' pregiata: se il pacchetto si riempie, cede la meno rara. */
    private static final List<String> GUARANTEE_ORDER = List.of("legendary", "epic", "rare");

    private final CardRepository cardRepository;
    private final SecureRandom random = new SecureRandom();

    public PackGenerator(CardRepository cardRepository) {
        this.cardRepository = cardRepository;
    }

    /** Da quanti pacchetti senza leggendaria la probabilita' comincia a salire. */
    public static final int PITY_SOFT = 20;
    /** Al pacchetto numero PITY_HARD senza leggendaria, una e' garantita. */
    public static final int PITY_HARD = 40;
    /** Carte del set della settimana nel pacchetto del weekend. */
    public static final int FEATURED_COUNT = 2;

    /** Moltiplicatore del peso della leggendaria dopo `pity` pacchetti senza. */
    static double pityBoost(int pity) {
        return pity < PITY_SOFT ? 1.0 : 1.0 + (pity - PITY_SOFT + 1) * 0.3;
    }

    public List<Card> generate(Pack pack) {
        return generate(pack, 0, List.of());
    }

    /**
     * @param pity     pacchetti aperti di fila senza leggendaria (0 = nessun aiuto)
     * @param featured carte in vetrina (il set del weekend): ne escono FEATURED_COUNT, il resto
     *                 si pesca fra le carte dello stesso gioco
     */
    public List<Card> generate(Pack pack, int pity, List<Card> featured) {
        List<Card> allCards = cardRepository.findAllActiveWithArtistClass();
        // Pacchetto di una sola fonte (per esempio Ultimate Team): si pesca solo fra quelle carte.
        if (pack.getSource() != null && !pack.getSource().isBlank()) {
            allCards = allCards.stream().filter(c -> pack.getSource().equals(c.getSource())).toList();
        }
        if (featured != null && !featured.isEmpty()) {
            Set<String> sources = featured.stream().map(Card::getSource).collect(Collectors.toSet());
            List<Card> sameGame = allCards.stream().filter(c -> sources.contains(c.getSource())).toList();
            if (sameGame.size() >= pack.getCardCount()) allCards = sameGame;
        }
        if (allCards.isEmpty()) {
            return List.of();
        }

        Map<String, List<Card>> byRarity = allCards.stream()
                .collect(Collectors.groupingBy(Card::getRarity));

        double bonusMultiplier = (pack.getEvent() != null && pack.getEvent().isActive())
                ? pack.getEvent().getBonusDropRateMultiplier()
                : 1.0;

        Map<String, Double> weights = new LinkedHashMap<>();
        pack.getDropRates().forEach(rate -> weights.put(
                rate.getRarity(),
                rate.getWeight() * (BOOSTED_RARITIES.contains(rate.getRarity()) ? bonusMultiplier : 1.0)
                        * ("legendary".equals(rate.getRarity()) ? pityBoost(pity) : 1.0)));

        Map<String, Integer> guarantees = new HashMap<>();
        pack.getGuarantees().forEach(g -> guarantees.put(g.getRarity(), g.getCount()));
        // Pity: dopo PITY_HARD - 1 pacchetti senza, la leggendaria e' garantita.
        if (pity >= PITY_HARD - 1) guarantees.merge("legendary", 1, Math::max);

        List<Card> result = new ArrayList<>(pack.getCardCount());
        Set<UUID> taken = new HashSet<>();

        if (featured != null) {
            for (int i = 0; i < FEATURED_COUNT && result.size() < pack.getCardCount(); i++) {
                Card card = pickFrom(featured, taken);
                if (card == null) break;
                result.add(card);
                taken.add(card.getId());
            }
        }

        for (String rarity : GUARANTEE_ORDER) {
            int count = guarantees.getOrDefault(rarity, 0);
            for (int i = 0; i < count && result.size() < pack.getCardCount(); i++) {
                Card card = pickFrom(byRarity.getOrDefault(rarity, List.of()), taken);
                if (card == null) break;
                result.add(card);
                taken.add(card.getId());
            }
        }

        while (result.size() < pack.getCardCount()) {
            String rarity = weightedRandomRarity(weights);
            Card card = pickFrom(byRarity.getOrDefault(rarity, List.of()), taken);
            if (card == null) {
                // Rarita' esaurita: si ripiega su una carta qualsiasi ancora disponibile.
                card = pickFrom(allCards, taken);
            }
            if (card == null) break; // catalogo esaurito, il pacchetto esce piu' corto
            result.add(card);
            taken.add(card.getId());
        }

        return result;
    }

    private Card pickFrom(List<Card> pool, Set<UUID> taken) {
        List<Card> available = pool.stream().filter(c -> !taken.contains(c.getId())).toList();
        if (available.isEmpty()) return null;
        return available.get(random.nextInt(available.size()));
    }

    /** Estrazione pesata. Pesi tutti a zero o assenti: si sceglie una rarita' a caso fra quelle note. */
    private String weightedRandomRarity(Map<String, Double> weights) {
        if (weights.isEmpty()) return null;

        double total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        List<String> rarities = List.copyOf(weights.keySet());
        if (total <= 0) {
            return rarities.get(random.nextInt(rarities.size()));
        }

        double roll = random.nextDouble() * total;
        for (Map.Entry<String, Double> entry : weights.entrySet()) {
            roll -= entry.getValue();
            if (roll <= 0) return entry.getKey();
        }
        return rarities.get(rarities.size() - 1);
    }
}
