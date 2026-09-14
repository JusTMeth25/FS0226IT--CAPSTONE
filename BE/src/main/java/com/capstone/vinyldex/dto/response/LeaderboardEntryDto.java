package com.capstone.vinyldex.dto.response;

import java.util.UUID;

/** Riga di classifica. Il significato di value dipende dal tipo richiesto: gold, vittorie o carte uniche. */
public record LeaderboardEntryDto(UUID userId, String username, long value) {
}
