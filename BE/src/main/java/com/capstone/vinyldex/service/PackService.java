package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.dto.response.PackDto;
import com.capstone.vinyldex.entity.*;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Vetrina dei pacchetti e apertura. */
@Service
public class PackService {

    private final PackRepository packRepository;
    private final UserRepository userRepository;
    private final UserPackCreditRepository packCreditRepository;
    private final PackOpeningRepository packOpeningRepository;
    private final PackOpeningCardRepository packOpeningCardRepository;
    private final PackGenerator packGenerator;
    private final WalletService walletService;
    private final UserCardService userCardService;
    private final MissionEngine missionEngine;

    public PackService(PackRepository packRepository,
                       UserRepository userRepository,
                       UserPackCreditRepository packCreditRepository,
                       PackOpeningRepository packOpeningRepository,
                       PackOpeningCardRepository packOpeningCardRepository,
                       PackGenerator packGenerator,
                       WalletService walletService,
                       UserCardService userCardService,
                       MissionEngine missionEngine) {
        this.packRepository = packRepository;
        this.userRepository = userRepository;
        this.packCreditRepository = packCreditRepository;
        this.packOpeningRepository = packOpeningRepository;
        this.packOpeningCardRepository = packOpeningCardRepository;
        this.packGenerator = packGenerator;
        this.walletService = walletService;
        this.userCardService = userCardService;
        this.missionEngine = missionEngine;
    }

    /** Versioni olografiche delle carte. Facoltativo, cosi' i test lo possono omettere. */
    private HoloCardService holoCardService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setHoloCardService(HoloCardService holoCardService) {
        this.holoCardService = holoCardService;
    }

    /** Vetrina. userId nullo per un visitatore non autenticato: niente pacchetti regalati. */
    @Transactional(readOnly = true)
    public PackListView listPacks(UUID userId) {
        Map<String, Integer> creditsByCode = userId == null
                ? Map.of()
                : packCreditRepository.findByUserIdAndQuantityGreaterThan(userId, 0).stream()
                .collect(Collectors.toMap(UserPackCredit::getPackCode, UserPackCredit::getQuantity));

        List<PackDto> packs = packRepository.findAllActiveWithRates().stream()
                .map(pack -> PackDto.from(pack, creditsByCode.getOrDefault(pack.getCode(), 0)))
                .toList();

        Instant lastFreePackAt = userId == null
                ? null
                : userRepository.findById(userId).map(User::getLastFreePackAt).orElse(null);

        return new PackListView(packs, lastFreePackAt);
    }

    /**
     * Apre un pacchetto e accredita le carte.
     *
     * @param mode "paid" scala i gold, "free" consuma il cooldown, "gift" consuma un credito
     */
    @Transactional
    public OpenPackResult openPack(UUID userId, String packCode, String mode) {
        Pack pack = packRepository.findByCodeWithRates(packCode)
                .filter(Pack::isActive)
                .orElseThrow(() -> ApiException.notFound("pack_not_found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        PackOpenMode openMode = switch (mode) {
            case "gift" -> PackOpenMode.GIFT;
            case "free" -> PackOpenMode.FREE;
            default -> PackOpenMode.PAID;
        };

        switch (openMode) {
            case GIFT -> consumeGiftCredit(userId, pack.getCode());
            case FREE -> consumeFreeCooldown(user, pack);
            case PAID -> walletService.adjustGold(userId, -pack.getPriceGold(),
                    WalletTransactionType.PACK_OPEN_PAID, pack.getId().toString());
        }

        CardSetService.Weekend weekend = WEEKEND_PACK.equals(pack.getCode()) ? weekend() : null;
        if (weekend != null && !weekend.active() && openMode != PackOpenMode.GIFT) throw ApiException.badRequest("weekend_only");
        List<Card> cards = packGenerator.generate(pack, user.getPackPity(), weekend == null ? List.of() : weekend.cards());
        // Pity counter: si azzera con una leggendaria, altrimenti sale di uno.
        user.setPackPity(cards.stream().anyMatch(c -> "legendary".equals(c.getRarity())) ? 0 : user.getPackPity() + 1);

        PackOpening opening = new PackOpening();
        opening.setUser(user);
        opening.setPack(pack);
        opening.setMode(openMode);
        opening.setGoldSpent(openMode == PackOpenMode.PAID ? pack.getPriceGold() : 0);
        packOpeningRepository.save(opening);

        Map<String, Integer> rarityCounts = new HashMap<>();
        List<Boolean> foil = new java.util.ArrayList<>();
        List<Card> found = new java.util.ArrayList<>();
        for (Card drawn : cards) {
            // Ogni tanto la carta esce olografica: piu' spesso le leggendarie. L'olografica e' una
            // versione a se' della carta (HoloCardService), non una copia di quella normale.
            boolean shiny = FOIL_RANDOM.nextDouble() < foilChance(drawn.getRarity());
            Card card = shiny && holoCardService != null ? holoCardService.holoOf(drawn) : drawn;
            foil.add(shiny);
            found.add(card);
            userCardService.add(user, card, 1);
            packOpeningCardRepository.save(new PackOpeningCard(opening, card, card.getRarity()));
            rarityCounts.merge(card.getRarity(), 1, Integer::sum);
        }

        missionEngine.incrementByType(user, MissionType.OPEN_PACKS, 1);
        missionEngine.incrementByType(user, MissionType.COLLECT_CARDS, cards.size());
        rarityCounts.forEach((rarity, count) ->
                missionEngine.incrementByType(user, MissionType.COLLECT_RARITY, count, rarity));
        missionEngine.recomputeAbsolute(user);

        // Il saldo si rilegge dall'entita' gestita: WalletService l'ha gia' aggiornata.
        int gold = userRepository.findById(userId).map(User::getGold).orElse(user.getGold());
        return new OpenPackResult(found.stream().map(CardDto::from).toList(), gold, foil, user.getPackPity());
    }

    /**
     * Compra un pacchetto senza aprirlo, come in edicola: si pagano i gold e il pacchetto va nella
     * borsa (fra i pacchetti da aprire), da dove si apre con la modalita' "gift".
     */
    @Transactional
    public PackPurchase buyPack(UUID userId, String packCode) {
        Pack pack = packRepository.findByCodeWithRates(packCode)
                .filter(Pack::isActive)
                .orElseThrow(() -> ApiException.notFound("pack_not_found"));
        if (pack.getPriceGold() <= 0) throw ApiException.badRequest("pack_not_for_sale");
        if (WEEKEND_PACK.equals(pack.getCode()) && !weekend().active()) throw ApiException.badRequest("weekend_only");

        User user = walletService.adjustGold(userId, -pack.getPriceGold(), WalletTransactionType.PACK_PURCHASE,
                pack.getId().toString(), "Edicola: " + pack.getName());
        UserPackCredit credit = packCreditRepository.findByUserIdAndPackCode(userId, pack.getCode())
                .orElseGet(() -> new UserPackCredit(user, pack.getCode(), 0));
        credit.setQuantity(credit.getQuantity() + 1);
        packCreditRepository.save(credit);
        return new PackPurchase(pack.getCode(), pack.getName(), credit.getQuantity(), user.getGold());
    }

    private void consumeGiftCredit(UUID userId, String packCode) {
        UserPackCredit credit = packCreditRepository.findByUserIdAndPackCode(userId, packCode)
                .filter(c -> c.getQuantity() > 0)
                .orElseThrow(() -> ApiException.conflict("no_gift_available"));
        credit.setQuantity(credit.getQuantity() - 1);
        packCreditRepository.save(credit);
    }

    private void consumeFreeCooldown(User user, Pack pack) {
        if (!pack.isFree()) {
            throw ApiException.badRequest("pack_not_free");
        }
        Duration cooldown = Duration.ofHours(pack.getFreeCooldownHours());
        Instant last = user.getLastFreePackAt();
        if (last != null && Duration.between(last, Instant.now()).compareTo(cooldown) < 0) {
            throw ApiException.conflict("cooldown");
        }
        user.setLastFreePackAt(Instant.now());
        userRepository.save(user);
    }

    /** Il pacchetto del weekend: si compra e si apre solo sabato e domenica. */
    public static final String WEEKEND_PACK = "pack-weekend";

    private CardSetService setService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setSetService(CardSetService setService) {
        this.setService = setService;
    }

    private CardSetService.Weekend weekend() {
        return setService == null
                ? new CardSetService.Weekend(false, null, null, null, List.of(), Instant.now(), Instant.now())
                : setService.weekend(java.time.ZonedDateTime.now());
    }

    /** Pity counter del giocatore, per la barra nella pagina dei pacchetti. */
    @Transactional(readOnly = true)
    public Map<String, Object> pity(UUID userId) {
        int pity = userRepository.findById(userId).map(User::getPackPity).orElse(0);
        return Map.of("pity", pity, "soft", PackGenerator.PITY_SOFT, "hard", PackGenerator.PITY_HARD);
    }

    /** Il pacchetto del weekend: il set in vetrina e quando si puo' aprire. */
    @Transactional(readOnly = true)
    public Map<String, Object> weekendInfo() {
        CardSetService.Weekend w = weekend();
        Map<String, Object> view = new java.util.LinkedHashMap<>();
        view.put("active", w.active());
        view.put("setKey", w.key());
        view.put("setTitle", w.title());
        view.put("icon", w.icon());
        view.put("startsAt", w.startsAt());
        view.put("endsAt", w.endsAt());
        view.put("cards", w.cards().stream().map(CardDto::from).toList());
        return view;
    }

    public record PackListView(List<PackDto> packs, Instant lastFreePackAt) {
    }

    /** Carte uscite, saldo, e quali sono olografiche (stesso ordine delle carte). */
    public record OpenPackResult(List<CardDto> cards, int gold, List<Boolean> foil, int pity) {
    }

    private static final java.util.Random FOIL_RANDOM = new java.util.Random();

    /** Probabilita' che una carta esca olografica. */
    static double foilChance(String rarity) {
        return switch (rarity == null ? "" : rarity) {
            case "legendary" -> 0.10;
            case "epic" -> 0.05;
            default -> 0.03;
        };
    }

    /** Esito di un acquisto in edicola: quanti pacchetti di quel tipo ci sono ora nella borsa. */
    public record PackPurchase(String packId, String name, int owned, int gold) {
    }
}
