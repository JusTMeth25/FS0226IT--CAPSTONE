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

    public List<Card> generate(Pack pack) {
        List<Card> allCards = cardRepository.findAllActiveWithArtistClass();
        // Pacchetto di una sola fonte (per esempio Ultimate Team): si pesca solo fra quelle carte.
        if (pack.getSource() != null && !pack.getSource().isBlank()) {
            allCards = allCards.stream().filter(c -> pack.getSource().equals(c.getSource())).toList();
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
                rate.getWeight() * (BOOSTED_RARITIES.contains(rate.getRarity()) ? bonusMultiplier : 1.0)));

        Map<String, Integer> guarantees = new HashMap<>();
        pack.getGuarantees().forEach(g -> guarantees.put(g.getRarity(), g.getCount()));

        List<Card> result = new ArrayList<>(pack.getCardCount());
        Set<UUID> taken = new HashSet<>();

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
