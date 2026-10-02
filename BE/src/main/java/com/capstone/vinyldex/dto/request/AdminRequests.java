package com.capstone.vinyldex.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Corpi delle richieste del pannello admin.
 * Nelle patch ogni campo e' opzionale: null significa "non toccare", non "azzera".
 */
public final class AdminRequests {

    private AdminRequests() {
    }

    public record BanRequest(String reason) {
    }

    public record GoldRequest(
            @NotNull(message = "invalid_gold") @Min(value = 0, message = "invalid_gold") Integer gold
    ) {
    }

    public record CardCreateRequest(
            @NotBlank(message = "missing_fields") String code,
            @NotBlank(message = "missing_fields") String name,
            @NotBlank(message = "missing_fields") String rarity,
            String variant,
            String imgUrl,
            Integer fans,
            Integer style,
            Integer influence,
            Integer energy,
            String description,
            String artistClassSlug
    ) {
    }

    public record CardUpdateRequest(
            String name,
            String rarity,
            String variant,
            String imgUrl,
            Integer fans,
            Integer style,
            Integer influence,
            Integer energy,
            String description,
            Boolean isActive
    ) {
    }

    public record PackCreateRequest(
            @NotBlank(message = "missing_fields") String code,
            @NotBlank(message = "missing_fields") String name,
            String description,
            @NotNull(message = "missing_fields") @Min(value = 0, message = "missing_fields") Integer priceGold,
            @NotNull(message = "missing_fields") @Min(value = 1, message = "missing_fields") Integer cardCount,
            Boolean isFree,
            Integer freeCooldownHours
    ) {
    }

    public record PackUpdateRequest(
            String name,
            String description,
            Integer priceGold,
            Integer cardCount,
            Boolean isFree,
            Integer freeCooldownHours,
            Boolean isActive,
            UUID eventId
    ) {
    }

    public record DropRatesRequest(Map<String, Double> dropRates) {
    }

    public record GuaranteesRequest(Map<String, Integer> guarantees) {
    }

    public record MissionCreateRequest(
            @NotBlank(message = "missing_fields") String code,
            @NotBlank(message = "missing_fields") String title,
            String description,
            @NotBlank(message = "missing_fields") String type,
            @NotNull(message = "missing_fields") @Min(value = 1, message = "missing_fields") Integer targetValue,
            Integer rewardGold,
            Integer rewardXp,
            String rewardPack,
            Boolean isDaily,
            UUID eventId
    ) {
    }

    public record MissionUpdateRequest(
            String title,
            String description,
            Integer targetValue,
            Integer rewardGold,
            Integer rewardXp,
            String rewardPack,
            Boolean isDaily,
            Boolean isActive
    ) {
    }

    public record EventCreateRequest(
            @NotBlank(message = "missing_fields") String code,
            @NotBlank(message = "missing_fields") String name,
            String description,
            Instant startsAt,
            Instant endsAt,
            Double bonusDropRateMultiplier
    ) {
    }

    public record EventUpdateRequest(
            String name,
            String description,
            Instant startsAt,
            Instant endsAt,
            Double bonusDropRateMultiplier,
            Boolean isActive
    ) {
    }

    /**
     * Parametri comuni a tutti gli import da API esterne.
     * query e set filtrano la sorgente, limit tiene sotto controllo la dimensione del batch.
     */
    public record ImportRequest(
            String query,
            String set,
            Integer limit,
            Integer page,
            Integer offset,
            Integer groupId,
            /** Tutto il catalogo della fonte, non un blocco a caso (solo i giochi che lo supportano). */
            Boolean all
    ) {
        public boolean wantsAll() {
            return Boolean.TRUE.equals(all);
        }

        public int limitOrDefault(int fallback, int max) {
            if (limit == null || limit < 1) return fallback;
            return Math.min(limit, max);
        }

        public int pageOrOne() {
            return page == null || page < 1 ? 1 : page;
        }
    }
}
