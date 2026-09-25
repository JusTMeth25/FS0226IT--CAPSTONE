package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.User;

import java.util.List;
import java.util.UUID;

/**
 * Utente come lo vedono gli altri nell'hotel.
 *
 * Volutamente minimo: nome, aspetto, livello e la carta migliore, che compare come
 * distintivo sopra l'avatar. Email, gold e ruolo non escono mai verso gli altri giocatori,
 * a differenza di PublicUserDto che serve al pannello admin.
 */
public record HotelUser(UUID id, String username, String look, int level, RoomItemView.CardView bestCard,
                        List<RoomItemView.CardView> topCards) {

    public HotelUser(UUID id, String username, String look, int level) {
        this(id, username, look, level, null, List.of());
    }

    public static HotelUser from(User user, HotelSocialService.Showcase showcase) {
        return new HotelUser(user.getId(), user.getUsername(), HotelLook.orDefault(user.getHotelLook()), user.getLevel(),
                null, List.of()).withShowcase(showcase);
    }

    /**
     * Stesso utente con le carte in mostra aggiornate (la migliore e le tre sopra la testa), per
     * esempio dopo aver aperto dei pacchetti o giocato una battaglia.
     */
    public HotelUser withShowcase(HotelSocialService.Showcase showcase) {
        return new HotelUser(id, username, look, level, RoomItemView.CardView.from(showcase.best()),
                showcase.top().stream().map(RoomItemView.CardView::from).toList());
    }
}
