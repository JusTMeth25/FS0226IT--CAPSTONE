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

    private CollectionExtrasService extras;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setExtras(CollectionExtrasService extras) {
        this.extras = extras;
    }

    /**
     * Catalogo filtrato con lo stato di possesso.
     *
     * @param owned "true" per le sole carte possedute, "false" per le sole mancanti, null per tutte
     */
    @Transactional(readOnly = true)
    public CollectionView getCollection(UUID userId, String search, String rarity, String set,
                                        String source, String owned) {

        // Le sole carte possedute (la collezione all'accesso, le carte da regalare o esporre): si parte
        // da quelle del giocatore invece che dall'intero catalogo, che conta decine di migliaia di carte.
        List<UserCard> userCards = userCardRepository.findByUserIdWithCard(userId);
        Map<UUID, UserCard> ownedByCardId = userCards.stream()
                .collect(Collectors.toMap(uc -> uc.getCard().getId(), Function.identity()));
        List<Card> cards = "true".equalsIgnoreCase(owned)
                ? userCards.stream().map(UserCard::getCard)
                        .filter(c -> c.isActive() && matches(c, search, rarity, set, source))
                        .sorted(java.util.Comparator.comparing(Card::getName, String.CASE_INSENSITIVE_ORDER))
                        .toList()
                : cardRepository.search(orEmpty(search), orEmpty(rarity), orEmpty(set), orEmpty(source));

        Map<UUID, Integer> serials = extras == null ? Map.of() : extras.firstEditions(userId);
        List<CollectionEntryDto> entries = cards.stream()
                .map(card -> CollectionEntryDto.from(card, ownedByCardId.get(card.getId())).withFirstEdition(serials.get(card.getId())))
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

    /** Stessi filtri di CardRepository.search, sulle carte gia' in memoria. */
    private static boolean matches(Card card, String search, String rarity, String set, String source) {
        if (!orEmpty(rarity).isEmpty() && !rarity.equals(card.getRarity())) return false;
        if (!orEmpty(source).isEmpty() && !source.equals(card.getSource())) return false;
        if (!orEmpty(search).isEmpty() && (card.getName() == null || !card.getName().toLowerCase().contains(search.toLowerCase()))) return false;
        if (!orEmpty(set).isEmpty()) {
            String needle = set.toLowerCase();
            String name = card.getSetName() == null ? "" : card.getSetName().toLowerCase();
            String code = card.getSetCode() == null ? "" : card.getSetCode().toLowerCase();
            return name.contains(needle) || code.contains(needle);
        }
        return true;
    }

    /** Carte del raccoglitore in una pagina, con il totale e quante se ne possiedono. */
    public record BinderPage(List<CollectionEntryDto> cards, int total, long owned, int offset) {
    }

    public static final int BINDER_MAX_LIMIT = 180;

    private CardSetService setService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setSetService(CardSetService setService) {
        this.setService = setService;
    }

    private volatile List<Card> sortedCatalog;
    private volatile Map<String, List<Card>> sortedBySource = Map.of();

    /**
     * Raccoglitore a pagine: le carte di un gioco (in ordine di set e di numero) o di un set,
     * dalla posizione offset, al massimo limit. I cataloghi interi contano migliaia di carte: il
     * libro chiede solo le pagine che sta per mostrare.
     */
    @Transactional(readOnly = true)
    public BinderPage binder(UUID userId, String source, String setKey, int offset, int limit) {
        List<Card> all;
        if (setKey != null && !setKey.isBlank()) {
            List<Card> members = setService == null ? null : setService.setCards(setKey);
            if (members == null) throw ApiException.notFound("set_not_found");
            all = members;
        } else {
            all = sortedSource(source == null || source.isBlank() ? "original" : source);
        }
        Map<UUID, UserCard> ownedByCardId = userCardRepository.findByUserIdWithCard(userId).stream()
                .filter(uc -> uc.getQuantity() > 0)
                .collect(Collectors.toMap(uc -> uc.getCard().getId(), Function.identity(), (a, b) -> a));
        int from = Math.max(0, Math.min(offset, all.size()));
        int to = Math.min(all.size(), from + Math.max(1, Math.min(limit, BINDER_MAX_LIMIT)));
        List<CollectionEntryDto> page = all.subList(from, to).stream()
                .map(card -> CollectionEntryDto.from(card, ownedByCardId.get(card.getId())))
                .toList();
        long owned = all.stream().filter(c -> ownedByCardId.containsKey(c.getId())).count();
        return new BinderPage(page, all.size(), owned, from);
    }

    /** Carte di un gioco nell'ordine del raccoglitore, ricalcolate solo quando cambia il catalogo in cache. */
    private List<Card> sortedSource(String source) {
        List<Card> catalog = cardRepository.findAllActiveWithArtistClass();
        if (sortedCatalog != catalog) {
            sortedBySource = new java.util.concurrent.ConcurrentHashMap<>();
            sortedCatalog = catalog;
        }
        return sortedBySource.computeIfAbsent(source, key -> catalog.stream()
                .filter(c -> key.equals(c.getSource()))
                .sorted(BINDER_ORDER)
                .toList());
    }

    /** Per set, poi per numero (anche "UE14BT/NIK-1-021" dopo "...-009"), poi per nome. */
    static final java.util.Comparator<Card> BINDER_ORDER = java.util.Comparator
            .comparing((Card c) -> c.getSetCode() == null ? "" : c.getSetCode())
            .thenComparing(c -> c.getNumber() == null ? "" : c.getNumber(), CollectionService::naturalCompare)
            .thenComparing(c -> c.getName() == null ? "" : c.getName(), String.CASE_INSENSITIVE_ORDER);

    /** Confronto "naturale": i gruppi di cifre si confrontano come numeri. */
    static int naturalCompare(String a, String b) {
        int i = 0;
        int j = 0;
        while (i < a.length() && j < b.length()) {
            char ca = a.charAt(i);
            char cb = b.charAt(j);
            if (Character.isDigit(ca) && Character.isDigit(cb)) {
                int si = i;
                int sj = j;
                while (i < a.length() && Character.isDigit(a.charAt(i))) i++;
                while (j < b.length() && Character.isDigit(b.charAt(j))) j++;
                String na = a.substring(si, i).replaceFirst("^0+(?=.)", "");
                String nb = b.substring(sj, j).replaceFirst("^0+(?=.)", "");
                if (na.length() != nb.length()) return na.length() - nb.length();
                int cmp = na.compareTo(nb);
                if (cmp != 0) return cmp;
            } else {
                if (ca != cb) return Character.compare(Character.toLowerCase(ca), Character.toLowerCase(cb));
                i++;
                j++;
            }
        }
        return (a.length() - i) - (b.length() - j);
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

    /** La stringa vuota significa "filtro non applicato": vedi CardRepository.search. */
    private static String orEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    public record CollectionView(List<CollectionEntryDto> collection, int albumCompletionPercent, long totalActiveCards) {
    }
}
