package com.capstone.vinyldex.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/** Corpi delle richieste di gioco: pacchetti, mercato, scambi, battaglie. */
public final class GameRequests {

    private GameRequests() {
    }

    /** packId e' il code del pacchetto. mode: "paid" (default), "free" o "gift". */
    public record OpenPackRequest(
            @NotBlank(message = "missing_pack_id") String packId,
            String mode
    ) {
        public String modeOrDefault() {
            return mode == null || mode.isBlank() ? "paid" : mode.toLowerCase();
        }
    }

    /** cardId e' il code pubblico della carta. */
    public record MarketListRequest(
            @NotBlank(message = "invalid_input") String cardId,
            @NotNull(message = "invalid_input") @Min(value = 1, message = "invalid_input") Integer quantity,
            @NotNull(message = "invalid_input") @Min(value = 1, message = "invalid_input") Integer pricePerUnit
    ) {
    }

    public record MarketBuyRequest(
            @NotNull(message = "missing_listing_id") UUID listingId,
            Integer quantity
    ) {
        public int quantityOrOne() {
            return quantity == null || quantity < 1 ? 1 : quantity;
        }
    }

    /** toUserId accetta sia lo username sia lo UUID del destinatario. */
    public record TradeCreateRequest(
            @NotBlank(message = "missing_recipient") String toUserId,
            List<TradeCardRequest> offeredCards,
            List<TradeCardRequest> requestedCards,
            Integer offeredGold,
            Integer requestedGold
    ) {
        public List<TradeCardRequest> offeredOrEmpty() {
            return offeredCards == null ? List.of() : offeredCards;
        }

        public List<TradeCardRequest> requestedOrEmpty() {
            return requestedCards == null ? List.of() : requestedCards;
        }

        public int offeredGoldOrZero() {
            return offeredGold == null || offeredGold < 0 ? 0 : offeredGold;
        }

        public int requestedGoldOrZero() {
            return requestedGold == null || requestedGold < 0 ? 0 : requestedGold;
        }
    }

    public record TradeCardRequest(
            @NotBlank(message = "card_not_found") String cardId,
            Integer quantity
    ) {
        public int quantityOrOne() {
            return quantity == null || quantity < 1 ? 1 : quantity;
        }
    }

    /**
     * Esito di una battaglia. Il client comunica solo il risultato: l'importo di gold e xp
     * lo decide sempre il server, cosi' non e' possibile ottenere ricompense arbitrarie
     * manipolando la richiesta.
     */
    public record BattleRewardRequest(
            String mode,
            String result,
            Integer stagesCleared,
            Boolean wonAllStages,
            // Carte schierate (code pubblici): contano per le "piu' usate" mostrate nell'hotel.
            List<String> cards
    ) {
        public boolean isTournament() {
            return "tournament".equalsIgnoreCase(mode);
        }

        public int stagesClearedOrZero() {
            return stagesCleared == null || stagesCleared < 0 ? 0 : stagesCleared;
        }

        public boolean wonAllStagesOrFalse() {
            return Boolean.TRUE.equals(wonAllStages);
        }

        /** Al massimo tre carte diverse: una squadra non ne ha di piu'. */
        public List<String> teamCodes() {
            return cards == null ? List.of() : cards.stream().filter(c -> c != null && !c.isBlank()).distinct().limit(3).toList();
        }
    }
}
