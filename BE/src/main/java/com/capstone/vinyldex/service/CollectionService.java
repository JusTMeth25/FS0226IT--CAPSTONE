package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.dto.response.CollectionEntryDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Catalogo carte e stato di possesso dell'utente. */
@Service
public class CollectionService {

    private final CardRepository cardRepository;
    private final UserCardRepository userCardRepository;

    public CollectionService(CardRepository cardRepository, UserCardRepository userCardRepository) {
        this.cardRepository = cardRepository;
        this.userCardRepository = userCardRepository;
    }

    /**
     * Catalogo filtrato con lo stato di possesso.
     *
     * @param owned "true" per le sole carte possedute, "false" per le sole mancanti, null per tutte
     */
    @Transactional(readOnly = true)
    public CollectionView getCollection(UUID userId, String search, String rarity, String set,
                                        String source, String owned) {

        List<Card> cards = cardRepository.search(blankToNull(search), blankToNull(rarity),
                blankToNull(set), blankToNull(source));

        Map<UUID, UserCard> ownedByCardId = userCardRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(uc -> uc.getCard().getId(), Function.identity()));

        List<CollectionEntryDto> entries = cards.stream()
                .map(card -> CollectionEntryDto.from(card, ownedByCardId.get(card.getId())))
                .filter(entry -> {
                    if ("true".equalsIgnoreCase(owned)) return entry.owned();
                    if ("false".equalsIgnoreCase(owned)) return !entry.owned();
                    return true;
                })
                .toList();

        // Il totale e' quello reale del catalogo, comprese le carte importate dalle API esterne.
        long totalActiveCards = cardRepository.countByActiveTrue();
        int percent = totalActiveCards > 0
                ? Math.round((ownedByCardId.size() * 100f) / totalActiveCards)
                : 0;

        return new CollectionView(entries, percent, totalActiveCards);
    }

    /** Lookup pubblico di una carta dal suo id pubblico, cioe' il code. */
    @Transactional(readOnly = true)
    public CardDto getCardByCode(String code) {
        Card card = cardRepository.findByCodeWithArtistClass(code)
                .filter(Card::isActive)
                .orElseThrow(() -> ApiException.notFound("card_not_found"));
        return CardDto.from(card);
    }

    /** Inverte il flag preferito. Richiede che la carta sia posseduta. */
    @Transactional
    public boolean toggleFavorite(UUID userId, String cardCode) {
        Card card = cardRepository.findByCode(cardCode)
                .orElseThrow(() -> ApiException.notFound("card_not_found"));

        UserCard userCard = userCardRepository.findByUserIdAndCardId(userId, card.getId())
                .orElseThrow(() -> ApiException.notFound("card_not_owned"));

        userCard.setFavorite(!userCard.isFavorite());
        return userCardRepository.save(userCard).isFavorite();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record CollectionView(List<CollectionEntryDto> collection, int albumCompletionPercent, long totalActiveCards) {
    }
}
