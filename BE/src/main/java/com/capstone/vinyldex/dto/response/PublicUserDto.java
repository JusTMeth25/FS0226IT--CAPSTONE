package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserRole;

import java.time.Instant;
import java.util.UUID;

/** Utente come compare accanto a un'inserzione o a uno scambio. Mai la password. */
public record PublicUserDto(
        UUID id,
        String username,
        String email,
        int gold,
        int xp,
        int level,
        UserRole role,
        boolean banned,
        Instant createdAt
) {

    public static PublicUserDto from(User user) {
        if (user == null) return null;
        return new PublicUserDto(
                user.getId(), user.getUsername(), user.getEmail(), user.getGold(), user.getXp(),
                user.getLevel(), user.getRole(), user.isBanned(), user.getCreatedAt());
    }
}
