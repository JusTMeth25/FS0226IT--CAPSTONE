package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserRole;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Profilo restituito a chi ha appena fatto login o registrazione. */
public record AuthUserDto(
        UUID id,
        String username,
        String email,
        int gold,
        int xp,
        int level,
        UserRole role,
        String avatar,
        String hotelLook,
        boolean banned,
        LocalDate lastLoginDate,
        int loginStreak,
        int battlesWon,
        Instant createdAt,
        Instant updatedAt,
        boolean twoFactorEnabled
) {

    public static AuthUserDto from(User user) {
        return new AuthUserDto(
                user.getId(), user.getUsername(), user.getEmail(), user.getGold(), user.getXp(),
                user.getLevel(), user.getRole(), user.getAvatar(), user.getHotelLook(), user.isBanned(),
                user.getLastLoginDate(), user.getLoginStreak(), user.getBattlesWon(),
                user.getCreatedAt(), user.getUpdatedAt(), user.isTwoFactorEnabled());
    }
}
