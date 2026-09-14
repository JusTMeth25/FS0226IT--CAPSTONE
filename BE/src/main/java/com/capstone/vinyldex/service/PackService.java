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

        List<Card> cards = packGenerator.generate(pack);

        PackOpening opening = new PackOpening();
        opening.setUser(user);
        opening.setPack(pack);
        opening.setMode(openMode);
        opening.setGoldSpent(openMode == PackOpenMode.PAID ? pack.getPriceGold() : 0);
        packOpeningRepository.save(opening);

        Map<String, Integer> rarityCounts = new HashMap<>();
        for (Card card : cards) {
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
        return new OpenPackResult(cards.stream().map(CardDto::from).toList(), gold);
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

    public record PackListView(List<PackDto> packs, Instant lastFreePackAt) {
    }

    public record OpenPackResult(List<CardDto> cards, int gold) {
    }
}
