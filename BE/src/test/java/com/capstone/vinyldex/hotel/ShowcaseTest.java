package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Le tre carte sopra la testa dell'avatar. */
class ShowcaseTest {

    private final User anna = new User();

    private UserCard owned(String code, double price, int battles) {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setCode(code);
        card.setRarity("rare");
        card.setMetadata(Map.of("marketPrice", price));
        UserCard uc = new UserCard(anna, card, 1);
        uc.setBattlesUsed(battles);
        return uc;
    }

    private static List<String> codes(List<Card> cards) {
        return cards.stream().map(Card::getCode).toList();
    }

    @Test
    @DisplayName("Senza battaglie si mostrano le tre carte piu' costose")
    void mostExpensiveWithoutBattles() {
        List<UserCard> cards = List.of(owned("a", 1, 0), owned("b", 50, 0), owned("c", 5, 0), owned("d", 20, 0));
        assertEquals(List.of("b", "d", "c"), codes(HotelSocialService.top(cards)));
    }

    @Test
    @DisplayName("Le carte piu' usate in battaglia vengono prima, poi si completa con le piu' costose")
    void mostUsedFirst() {
        List<UserCard> cards = List.of(owned("a", 1, 7), owned("b", 50, 0), owned("c", 5, 2), owned("d", 20, 0));
        assertEquals(List.of("a", "c", "b"), codes(HotelSocialService.top(cards)));
    }

    @Test
    @DisplayName("Con meno di tre carte se ne mostrano quante ce ne sono")
    void fewCards() {
        assertEquals(List.of("a"), codes(HotelSocialService.top(List.of(owned("a", 1, 0)))));
    }

    @Test
    @DisplayName("Le carte scelte dal giocatore vengono prima, nell'ordine scelto; i posti liberi si riempiono da soli")
    void chosenFirst() {
        List<UserCard> cards = List.of(owned("a", 1, 0), owned("b", 50, 0), owned("c", 5, 0), owned("d", 20, 0));
        assertEquals(List.of("a", "c", "b"), codes(HotelSocialService.top(cards, List.of("a", "c", "a"))));
        assertEquals(List.of("c", "a", "b"), codes(HotelSocialService.top(cards, List.of("c", "a"))));
    }

    @Test
    @DisplayName("Una carta scelta che non si possiede piu' viene sostituita in automatico")
    void soldCardReplaced() {
        List<UserCard> cards = List.of(owned("a", 1, 0), owned("b", 50, 0), owned("c", 5, 0));
        assertEquals(List.of("a", "b", "c"), codes(HotelSocialService.top(cards, List.of("venduta", "a"))));
        assertEquals(List.of("x", "y"), HotelSocialService.codes(" x, y ,,"));
    }
}
