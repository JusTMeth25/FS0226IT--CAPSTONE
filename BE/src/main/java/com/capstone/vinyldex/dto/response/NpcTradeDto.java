package com.capstone.vinyldex.dto.response;

import java.time.Instant;
import java.util.UUID;

/** Scambio concluso con un NPC dell'hotel: la carta data e quella ricevuta. */
public record NpcTradeDto(UUID id, String npcName, CardDto gave, CardDto got, Instant createdAt) {
}
