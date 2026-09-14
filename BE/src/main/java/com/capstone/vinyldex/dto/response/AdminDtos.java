package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Risposte del pannello admin.
 *
 * Qui gli id sono gli UUID reali e non i code pubblici: l'amministratore lavora sulle righe,
 * e sono gli UUID che gli endpoint di modifica si aspettano nel percorso.
 */
public final class AdminDtos {

    private AdminDtos() {
    }

    public record AdminCardDto(
            UUID id,
            String code,
            String name,
            String artistClass,
            String variant,
            String rarity,
            String source,
            String setName,
            String setCode,
            String number,
            String imgUrl,
            String description,
            int fans,
            int style,
            int influence,
            int energy,
            boolean isActive,
            Double marketPrice,
            Instant createdAt
    ) {
        public static AdminCardDto from(Card card) {
            return new AdminCardDto(
                    card.getId(), card.getCode(), card.getName(),
                    card.getArtistClass() != null ? card.getArtistClass().getName() : null,
                    card.getVariant(), card.getRarity(), card.getSource(), card.getSetName(),
                    card.getSetCode(), card.getNumber(), card.getImgUrl(), card.getDescription(),
                    card.getFans(), card.getStyle(), card.getInfluence(), card.getEnergy(),
                    card.isActive(), card.getMarketPrice(), card.getCreatedAt());
        }
    }

    public record AdminPackDto(
            UUID id,
            String code,
            String name,
            String description,
            int priceGold,
            int cardCount,
            boolean isFree,
            int freeCooldownHours,
            String imgUrl,
            boolean isActive,
            UUID eventId,
            Map<String, Double> dropRates,
            Map<String, Integer> guarantees,
            Instant createdAt
    ) {
        public static AdminPackDto from(Pack pack) {
            Map<String, Double> rates = new LinkedHashMap<>();
            pack.getDropRates().forEach(dr -> rates.put(dr.getRarity(), dr.getWeight()));

            Map<String, Integer> guarantees = new LinkedHashMap<>();
            pack.getGuarantees().forEach(g -> guarantees.put(g.getRarity(), g.getCount()));

            return new AdminPackDto(
                    pack.getId(), pack.getCode(), pack.getName(), pack.getDescription(),
                    pack.getPriceGold(), pack.getCardCount(), pack.isFree(), pack.getFreeCooldownHours(),
                    pack.getImgUrl(), pack.isActive(),
                    pack.getEvent() != null ? pack.getEvent().getId() : null,
                    rates, guarantees, pack.getCreatedAt());
        }
    }

    public record AdminMissionDto(
            UUID id,
            String code,
            String title,
            String description,
            String type,
            int targetValue,
            int rewardGold,
            int rewardXp,
            String rewardPack,
            boolean isDaily,
            boolean isActive,
            UUID eventId,
            Instant createdAt
    ) {
        public static AdminMissionDto from(Mission mission) {
            return new AdminMissionDto(
                    mission.getId(), mission.getCode(), mission.getTitle(), mission.getDescription(),
                    mission.getType(), mission.getTargetValue(), mission.getRewardGold(), mission.getRewardXp(),
                    mission.getRewardPack(), mission.isDaily(), mission.isActive(),
                    mission.getEvent() != null ? mission.getEvent().getId() : null,
                    mission.getCreatedAt());
        }
    }

    public record AdminEventDto(
            UUID id,
            String code,
            String name,
            String description,
            Instant startsAt,
            Instant endsAt,
            double bonusDropRateMultiplier,
            boolean isActive,
            Instant createdAt
    ) {
        public static AdminEventDto from(Event event) {
            return new AdminEventDto(
                    event.getId(), event.getCode(), event.getName(), event.getDescription(),
                    event.getStartsAt(), event.getEndsAt(), event.getBonusDropRateMultiplier(),
                    event.isActive(), event.getCreatedAt());
        }
    }

    public record PackOpeningLogDto(
            UUID id,
            PublicUserDto user,
            NamedRef pack,
            PackOpenMode mode,
            int goldSpent,
            Instant createdAt
    ) {
        public static PackOpeningLogDto from(PackOpening opening) {
            return new PackOpeningLogDto(
                    opening.getId(),
                    PublicUserDto.from(opening.getUser()),
                    new NamedRef(opening.getPack().getName(), opening.getPack().getCode()),
                    opening.getMode(), opening.getGoldSpent(), opening.getCreatedAt());
        }
    }

    public record AdminListingDto(
            UUID id,
            PublicUserDto seller,
            NamedRef card,
            int quantity,
            int pricePerUnit,
            MarketListingStatus status,
            Instant createdAt
    ) {
        public static AdminListingDto from(MarketListing listing) {
            return new AdminListingDto(
                    listing.getId(),
                    PublicUserDto.from(listing.getSeller()),
                    new NamedRef(listing.getCard().getName(), listing.getCard().getCode()),
                    listing.getQuantity(), listing.getPricePerUnit(), listing.getStatus(),
                    listing.getCreatedAt());
        }
    }

    public record AdminTradeDto(
            UUID id,
            PublicUserDto fromUser,
            PublicUserDto toUser,
            TradeStatus status,
            Instant createdAt
    ) {
        public static AdminTradeDto from(Trade trade) {
            return new AdminTradeDto(
                    trade.getId(),
                    PublicUserDto.from(trade.getFromUser()),
                    PublicUserDto.from(trade.getToUser()),
                    trade.getStatus(), trade.getCreatedAt());
        }
    }

    /** Riferimento compatto a un'entita' nei log: basta il nome leggibile piu' il codice. */
    public record NamedRef(String name, String code) {
    }
}
