package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.User;

import java.util.UUID;

/**
 * Utente come lo vedono gli altri nell'hotel.
 *
 * Volutamente minimo: nome, aspetto e livello. Email, gold e ruolo non escono mai verso
 * gli altri giocatori, a differenza di PublicUserDto che serve al pannello admin.
 */
public record HotelUser(UUID id, String username, String look, int level) {

    public static HotelUser from(User user) {
        return new HotelUser(user.getId(), user.getUsername(), HotelLook.orDefault(user.getHotelLook()), user.getLevel());
    }
}
