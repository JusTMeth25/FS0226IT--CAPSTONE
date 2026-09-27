package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.RoomLikeRepository;
import com.capstone.vinyldex.repository.RoomRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.repository.UserRespectRepository;
import com.capstone.vinyldex.service.CardSetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Distintivo indossato nell'hotel: solo fra quelli sbloccati, e sparisce se si perde. */
class WornBadgeTest {

    private final UserRepository users = mock(UserRepository.class);
    private final UserCardRepository userCards = mock(UserCardRepository.class);
    private final CardSetService sets = mock(CardSetService.class);
    private final HotelSocialService service = new HotelSocialService(users, mock(UserRespectRepository.class),
            mock(RoomLikeRepository.class), mock(RoomRepository.class), userCards, sets);
    private final UUID id = UUID.randomUUID();
    private final User user = new User();

    @BeforeEach
    void setUp() {
        user.setId(id);
        user.setLevel(12);
        when(users.findById(id)).thenReturn(Optional.of(user));
        when(userCards.findByUserIdWithCard(id)).thenReturn(List.of());
        when(sets.badges(id)).thenReturn(List.of(
                Map.of("code", "set-pokemon-pikachu", "name", "Pikachu", "description", "Set completato", "icon", "lightning")));
    }

    @Test
    @DisplayName("Si indossa un distintivo del set completato e l'avatar lo mostra con nome e icona")
    void wearSetBadge() {
        assertEquals("set-pokemon-pikachu", service.wear(id, "set-pokemon-pikachu").get("wornBadge"));
        HotelUser.WornBadge worn = service.wornBadge(id);
        assertEquals("Pikachu", worn.name());
        assertEquals("lightning", worn.icon());
    }

    @Test
    @DisplayName("Anche i distintivi del livello si possono indossare; null li toglie")
    void wearLevelBadgeAndRemove() {
        service.wear(id, "level2");
        assertEquals("Esperto", service.wornBadge(id).name());
        service.wear(id, null);
        assertNull(service.wornBadge(id));
    }

    @Test
    @DisplayName("Un distintivo non sbloccato non si indossa, e uno perso non si mostra piu'")
    void lockedBadge() {
        ApiException error = assertThrows(ApiException.class, () -> service.wear(id, "champion"));
        assertEquals("badge_locked", error.getCode());
        user.setWornBadge("champion");
        assertNull(service.wornBadge(id));
    }
}
