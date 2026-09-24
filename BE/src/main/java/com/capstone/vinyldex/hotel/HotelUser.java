package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;

import java.util.UUID;

/**
 * Utente come lo vedono gli altri nell'hotel.
 *
 * Volutamente minimo: nome, aspetto, livello e la carta migliore, che compare come
 * distintivo sopra l'avatar. Email, gold e ruolo non escono mai verso gli altri giocatori,
 * a differenza di PublicUserDto che serve al pannello admin.
 */
public record HotelUser(UUID id, String username, String look, int level, RoomItemView.CardView bestCard) {

    public HotelUser(UUID id, String username, String look, int level) {
        this(id, username, look, level, null);
    }

    public static HotelUser from(User user, Card bestCard) {
        return new HotelUser(user.getId(), user.getUsername(), HotelLook.orDefault(user.getHotelLook()), user.getLevel(),
                RoomItemView.CardView.from(bestCard));
    }

    /** Stesso utente con la carta migliore aggiornata, per esempio dopo aver aperto dei pacchetti. */
    public HotelUser withBestCard(Card card) {
        return new HotelUser(id, username, look, level, RoomItemView.CardView.from(card));
    }
}
