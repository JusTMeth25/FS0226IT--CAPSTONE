package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.dto.response.AdminDtos;
import com.capstone.vinyldex.dto.response.PublicUserDto;
import com.capstone.vinyldex.entity.*;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.*;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Operazioni del pannello di amministrazione. */
@Service
public class AdminService {

    /** Quante righe mostrare nei log: abbastanza per capire cosa succede, non tanto da rallentare. */
    private static final Limit LOG_LIMIT = Limit.of(100);

    private final UserRepository userRepository;
    private final CardRepository cardRepository;
    private final ArtistClassRepository artistClassRepository;
    private final PackRepository packRepository;
    private final PackDropRateRepository dropRateRepository;
    private final PackGuaranteeRepository guaranteeRepository;
    private final PackOpeningRepository packOpeningRepository;
    private final MarketListingRepository listingRepository;
    private final TradeRepository tradeRepository;
    private final MissionRepository missionRepository;
    private final EventRepository eventRepository;
    private final WalletService walletService;

    public AdminService(UserRepository userRepository,
                        CardRepository cardRepository,
                        ArtistClassRepository artistClassRepository,
                        PackRepository packRepository,
                        PackDropRateRepository dropRateRepository,
                        PackGuaranteeRepository guaranteeRepository,
                        PackOpeningRepository packOpeningRepository,
                        MarketListingRepository listingRepository,
                        TradeRepository tradeRepository,
                        MissionRepository missionRepository,
                        EventRepository eventRepository,
                        WalletService walletService) {
        this.userRepository = userRepository;
        this.cardRepository = cardRepository;
        this.artistClassRepository = artistClassRepository;
        this.packRepository = packRepository;
        this.dropRateRepository = dropRateRepository;
        this.guaranteeRepository = guaranteeRepository;
        this.packOpeningRepository = packOpeningRepository;
        this.listingRepository = listingRepository;
        this.tradeRepository = tradeRepository;
        this.missionRepository = missionRepository;
        this.eventRepository = eventRepository;
        this.walletService = walletService;
    }

    // ------------------------------------------------------------------ utenti

    @Transactional(readOnly = true)
    public List<PublicUserDto> listUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc().stream().map(PublicUserDto::from).toList();
    }

    @Transactional
    public PublicUserDto setBanned(UUID userId, boolean banned, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));
        user.setBanned(banned);
        user.setBanReason(banned ? reason : null);
        return PublicUserDto.from(userRepository.save(user));
    }

    /**
     * Porta il saldo al valore indicato.
     *
     * Il movimento passa comunque da WalletService: anche una correzione manuale deve lasciare
     * traccia in contabilita', altrimenti il registro non torna piu' con il saldo.
     */
    @Transactional
    public PublicUserDto setGold(UUID userId, int targetGold, String adminUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        int delta = targetGold - user.getGold();
        if (delta == 0) {
            return PublicUserDto.from(user);
        }

        User updated = walletService.adjustGold(userId, delta,
                WalletTransactionType.ADMIN_ADJUST, null, "admin:" + adminUsername);
        return PublicUserDto.from(updated);
    }

    // ------------------------------------------------------------------- carte

    /** Il catalogo conta decine di migliaia di carte: la tabella dell'admin ne mostra al massimo tante. */
    public static final int CARD_LIST_LIMIT = 300;

    /** Le carte piu' recenti, o quelle con q nel nome, nel codice o come fonte. */
    @Transactional(readOnly = true)
    public List<AdminDtos.AdminCardDto> listCards(String q) {
        String query = q == null ? "" : q.trim();
        return cardRepository.adminSearch(query, org.springframework.data.domain.PageRequest.of(0, CARD_LIST_LIMIT)).stream()
                .map(AdminDtos.AdminCardDto::from)
                .toList();
    }

    @Transactional
    public AdminDtos.AdminCardDto createCard(AdminRequests.CardCreateRequest request) {
        if (cardRepository.findByCode(request.code()).isPresent()) {
            throw ApiException.conflict("code_taken");
        }

        Card card = new Card();
        card.setCode(request.code());
        card.setName(request.name());
        card.setRarity(request.rarity());
        card.setVariant(request.variant());
        card.setImgUrl(request.imgUrl());
        card.setDescription(request.description());
        card.setFans(orDefault(request.fans(), 50));
        card.setStyle(orDefault(request.style(), 50));
        card.setInfluence(orDefault(request.influence(), 50));
        card.setEnergy(orDefault(request.energy(), 50));
        card.setSource("original");

        if (request.artistClassSlug() != null) {
            artistClassRepository.findBySlug(request.artistClassSlug()).ifPresent(card::setArtistClass);
        }

        return AdminDtos.AdminCardDto.from(cardRepository.save(card));
    }

    @Transactional
    public AdminDtos.AdminCardDto updateCard(UUID cardId, AdminRequests.CardUpdateRequest request) {
        Card card = cardRepository.findById(cardId)
                .orElseThrow(() -> ApiException.notFound("card_not_found"));

        if (request.name() != null) card.setName(request.name());
        if (request.rarity() != null) card.setRarity(request.rarity());
        if (request.variant() != null) card.setVariant(request.variant());
        if (request.imgUrl() != null) card.setImgUrl(request.imgUrl());
        if (request.fans() != null) card.setFans(request.fans());
        if (request.style() != null) card.setStyle(request.style());
        if (request.influence() != null) card.setInfluence(request.influence());
        if (request.energy() != null) card.setEnergy(request.energy());
        if (request.description() != null) card.setDescription(request.description());
        if (request.isActive() != null) card.setActive(request.isActive());

        return AdminDtos.AdminCardDto.from(cardRepository.save(card));
    }

    // -------------------------------------------------------------- pacchetti

    @Transactional(readOnly = true)
    public List<AdminDtos.AdminPackDto> listPacks() {
        return packRepository.findAllWithRates().stream().map(AdminDtos.AdminPackDto::from).toList();
    }

    @Transactional
    public AdminDtos.AdminPackDto createPack(AdminRequests.PackCreateRequest request) {
        if (packRepository.findByCode(request.code()).isPresent()) {
            throw ApiException.conflict("code_taken");
        }

        Pack pack = new Pack();
        pack.setCode(request.code());
        pack.setName(request.name());
        pack.setDescription(request.description());
        pack.setPriceGold(request.priceGold());
        pack.setCardCount(request.cardCount());
        pack.setFree(Boolean.TRUE.equals(request.isFree()));
        pack.setFreeCooldownHours(orDefault(request.freeCooldownHours(), 0));

        return AdminDtos.AdminPackDto.from(packRepository.save(pack));
    }

    @Transactional
    public AdminDtos.AdminPackDto updatePack(UUID packId, AdminRequests.PackUpdateRequest request) {
        Pack pack = packRepository.findById(packId)
                .orElseThrow(() -> ApiException.notFound("pack_not_found"));

        if (request.name() != null) pack.setName(request.name());
        if (request.description() != null) pack.setDescription(request.description());
        if (request.priceGold() != null) pack.setPriceGold(request.priceGold());
        if (request.cardCount() != null) pack.setCardCount(request.cardCount());
        if (request.isFree() != null) pack.setFree(request.isFree());
        if (request.freeCooldownHours() != null) pack.setFreeCooldownHours(request.freeCooldownHours());
        if (request.isActive() != null) pack.setActive(request.isActive());
        if (request.eventId() != null) {
            pack.setEvent(eventRepository.findById(request.eventId())
                    .orElseThrow(() -> ApiException.notFound("event_not_found")));
        }

        return AdminDtos.AdminPackDto.from(packRepository.save(pack));
    }

    /** Sostituisce in blocco le probabilita' di drop: quelle non ripassate vengono rimosse. */
    @Transactional
    public void replaceDropRates(UUID packId, Map<String, Double> dropRates) {
        Pack pack = packRepository.findById(packId)
                .orElseThrow(() -> ApiException.notFound("pack_not_found"));

        dropRateRepository.deleteByPackId(packId);
        dropRateRepository.flush();

        if (dropRates == null) return;
        dropRates.forEach((rarity, weight) -> {
            PackDropRate rate = new PackDropRate();
            rate.setPack(pack);
            rate.setRarity(rarity);
            rate.setWeight(weight == null ? 0 : weight);
            dropRateRepository.save(rate);
        });
    }

    /** Sostituisce in blocco le garanzie: quelle non ripassate vengono rimosse. */
    @Transactional
    public void replaceGuarantees(UUID packId, Map<String, Integer> guarantees) {
        Pack pack = packRepository.findById(packId)
                .orElseThrow(() -> ApiException.notFound("pack_not_found"));

        guaranteeRepository.deleteByPackId(packId);
        guaranteeRepository.flush();

        if (guarantees == null) return;
        guarantees.forEach((rarity, count) -> {
            PackGuarantee guarantee = new PackGuarantee();
            guarantee.setPack(pack);
            guarantee.setRarity(rarity);
            guarantee.setCount(count == null ? 0 : count);
            guaranteeRepository.save(guarantee);
        });
    }

    // ---------------------------------------------------------------- missioni

    @Transactional(readOnly = true)
    public List<AdminDtos.AdminMissionDto> listMissions() {
        return missionRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(AdminDtos.AdminMissionDto::from)
                .toList();
    }

    @Transactional
    public AdminDtos.AdminMissionDto createMission(AdminRequests.MissionCreateRequest request) {
        if (missionRepository.findByCode(request.code()).isPresent()) {
            throw ApiException.conflict("code_taken");
        }

        Mission mission = new Mission();
        mission.setCode(request.code());
        mission.setTitle(request.title());
        mission.setDescription(request.description());
        mission.setType(request.type());
        mission.setTargetValue(request.targetValue());
        mission.setRewardGold(orDefault(request.rewardGold(), 0));
        mission.setRewardXp(orDefault(request.rewardXp(), 0));
        mission.setRewardPack(request.rewardPack());
        mission.setDaily(Boolean.TRUE.equals(request.isDaily()));

        if (request.eventId() != null) {
            mission.setEvent(eventRepository.findById(request.eventId())
                    .orElseThrow(() -> ApiException.notFound("event_not_found")));
        }

        return AdminDtos.AdminMissionDto.from(missionRepository.save(mission));
    }

    @Transactional
    public AdminDtos.AdminMissionDto updateMission(UUID missionId, AdminRequests.MissionUpdateRequest request) {
        Mission mission = missionRepository.findById(missionId)
                .orElseThrow(() -> ApiException.notFound("mission_not_found"));

        if (request.title() != null) mission.setTitle(request.title());
        if (request.description() != null) mission.setDescription(request.description());
        if (request.targetValue() != null) mission.setTargetValue(request.targetValue());
        if (request.rewardGold() != null) mission.setRewardGold(request.rewardGold());
        if (request.rewardXp() != null) mission.setRewardXp(request.rewardXp());
        if (request.rewardPack() != null) mission.setRewardPack(request.rewardPack());
        if (request.isDaily() != null) mission.setDaily(request.isDaily());
        if (request.isActive() != null) mission.setActive(request.isActive());

        return AdminDtos.AdminMissionDto.from(missionRepository.save(mission));
    }

    // ------------------------------------------------------------------ eventi

    @Transactional(readOnly = true)
    public List<AdminDtos.AdminEventDto> listEvents() {
        return eventRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(AdminDtos.AdminEventDto::from)
                .toList();
    }

    @Transactional
    public AdminDtos.AdminEventDto createEvent(AdminRequests.EventCreateRequest request) {
        if (eventRepository.findByCode(request.code()).isPresent()) {
            throw ApiException.conflict("code_taken");
        }

        Event event = new Event();
        event.setCode(request.code());
        event.setName(request.name());
        event.setDescription(request.description());
        event.setStartsAt(request.startsAt());
        event.setEndsAt(request.endsAt());
        event.setBonusDropRateMultiplier(request.bonusDropRateMultiplier() == null
                ? 1.0 : request.bonusDropRateMultiplier());

        return AdminDtos.AdminEventDto.from(eventRepository.save(event));
    }

    @Transactional
    public AdminDtos.AdminEventDto updateEvent(UUID eventId, AdminRequests.EventUpdateRequest request) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("event_not_found"));

        if (request.name() != null) event.setName(request.name());
        if (request.description() != null) event.setDescription(request.description());
        if (request.startsAt() != null) event.setStartsAt(request.startsAt());
        if (request.endsAt() != null) event.setEndsAt(request.endsAt());
        if (request.bonusDropRateMultiplier() != null) {
            event.setBonusDropRateMultiplier(request.bonusDropRateMultiplier());
        }
        if (request.isActive() != null) event.setActive(request.isActive());

        return AdminDtos.AdminEventDto.from(eventRepository.save(event));
    }

    // --------------------------------------------------------------------- log

    @Transactional(readOnly = true)
    public List<AdminDtos.PackOpeningLogDto> listPackOpeningLogs() {
        return packOpeningRepository.findRecentWithUserAndPack(LOG_LIMIT).stream()
                .map(AdminDtos.PackOpeningLogDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminDtos.AdminListingDto> listAllListings() {
        return listingRepository.findRecentWithCardAndSeller(LOG_LIMIT).stream()
                .map(AdminDtos.AdminListingDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminDtos.AdminTradeDto> listAllTrades() {
        return tradeRepository.findRecentWithUsers(LOG_LIMIT).stream()
                .map(AdminDtos.AdminTradeDto::from)
                .toList();
    }

    private static int orDefault(Integer value, int fallback) {
        return value == null ? fallback : value;
    }
}
