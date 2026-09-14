package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Trade;
import com.capstone.vinyldex.entity.TradeItemDirection;
import com.capstone.vinyldex.entity.TradeStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Proposta di scambio. Le carte sono divise nelle due direzioni, come le legge il frontend. */
public record TradeDto(
        UUID id,
        PublicUserDto fromUser,
        PublicUserDto toUser,
        TradeStatus status,
        int offeredGold,
        int requestedGold,
        List<TradeCardDto> offeredCards,
        List<TradeCardDto> requestedCards,
        Instant createdAt,
        Instant updatedAt
) {

    public static TradeDto from(Trade trade) {
        return new TradeDto(
                trade.getId(),
                PublicUserDto.from(trade.getFromUser()),
                PublicUserDto.from(trade.getToUser()),
                trade.getStatus(),
                trade.getOfferedGold(),
                trade.getRequestedGold(),
                itemsOf(trade, TradeItemDirection.OFFERED),
                itemsOf(trade, TradeItemDirection.REQUESTED),
                trade.getCreatedAt(),
                trade.getUpdatedAt());
    }

    private static List<TradeCardDto> itemsOf(Trade trade, TradeItemDirection direction) {
        return trade.getItems().stream()
                .filter(item -> item.getDirection() == direction)
                .map(item -> new TradeCardDto(CardDto.from(item.getCard()), item.getQuantity()))
                .toList();
    }

    public record TradeCardDto(CardDto card, int quantity) {
    }
}
