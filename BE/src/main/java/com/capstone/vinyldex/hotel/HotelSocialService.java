package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Room;
import com.capstone.vinyldex.entity.RoomLike;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.entity.UserRespect;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.RoomLikeRepository;
import com.capstone.vinyldex.repository.RoomRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.repository.UserRespectRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Parte social dell'hotel: rispetto, "mi piace" alle stanze e scheda profilo con distintivi.
 */
@Service
public class HotelSocialService {

    /** Rispetti che ogni giocatore puo' dare al giorno, come su Habbo. */
    public static final int DAILY_RESPECTS = 3;

    private static final Map<String, Integer> RARITY_ORDER = Map.of(
            "common", 1, "uncommon", 2, "rare", 3, "epic", 4, "legendary", 5);

    private final UserRepository userRepository;
    private final UserRespectRepository respectRepository;
    private final RoomLikeRepository likeRepository;
    private final RoomRepository roomRepository;
    private final UserCardRepository userCardRepository;
    private final Clock clock;

    public HotelSocialService(UserRepository userRepository, UserRespectRepository respectRepository,
                              RoomLikeRepository likeRepository, RoomRepository roomRepository,
                              UserCardRepository userCardRepository) {
        this.userRepository = userRepository;
        this.respectRepository = respectRepository;
        this.likeRepository = likeRepository;
        this.roomRepository = roomRepository;
        this.userCardRepository = userCardRepository;
        this.clock = Clock.systemDefaultZone();
    }

    public record RespectResult(int receivedTotal, int remainingToday) {
    }

    /**
     * Da' rispetto a un altro giocatore. Un solo rispetto per persona al giorno, tre in tutto.
     * Il vincolo unico del database copre anche due clic arrivati nello stesso istante.
     */
    @Transactional
    public RespectResult respect(UUID giverId, UUID receiverId) {
        if (giverId.equals(receiverId)) throw ApiException.badRequest("cannot_respect_yourself");
        if (!userRepository.existsById(receiverId)) throw ApiException.notFound("user_not_found");

        LocalDate today = LocalDate.now(clock);
        long given = respectRepository.countByGiverIdAndDay(giverId, today);
        if (given >= DAILY_RESPECTS) throw ApiException.badRequest("no_respects_left");
        if (respectRepository.existsByGiverIdAndReceiverIdAndDay(giverId, receiverId, today)) {
            throw ApiException.badRequest("already_respected");
        }

        UserRespect respect = new UserRespect();
        respect.setGiverId(giverId);
        respect.setReceiverId(receiverId);
        respect.setDay(today);
        try {
            respectRepository.saveAndFlush(respect);
        } catch (DataIntegrityViolationException ex) {
            throw ApiException.badRequest("already_respected");
        }
        return new RespectResult((int) respectRepository.countByReceiverId(receiverId), (int) (DAILY_RESPECTS - given - 1));
    }

    /** Mette o toglie il "mi piace" a una stanza. Non si puo' mettere alla propria. */
    @Transactional
    public Map<String, Object> toggleLike(UUID userId, UUID roomId) {
        Room room = roomRepository.findWithOwner(roomId).orElseThrow(() -> ApiException.notFound("room_not_found"));
        if (room.getOwner() != null && room.getOwner().getId().equals(userId)) {
            throw ApiException.badRequest("cannot_like_own_room");
        }

        Optional<RoomLike> existing = likeRepository.findByRoomIdAndUserId(roomId, userId);
        boolean liked;
        if (existing.isPresent()) {
            likeRepository.delete(existing.get());
            liked = false;
        } else {
            RoomLike like = new RoomLike();
            like.setRoomId(roomId);
            like.setUserId(userId);
            likeRepository.save(like);
            liked = true;
        }
        likeRepository.flush();
        return Map.of("liked", liked, "likes", likeRepository.countByRoomId(roomId));
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> likesByRoom() {
        Map<UUID, Long> result = new HashMap<>();
        likeRepository.countAll().forEach(row -> result.put(row.getRoomId(), row.getLikes()));
        return result;
    }

    @Transactional(readOnly = true)
    public boolean hasLiked(UUID userId, UUID roomId) {
        return likeRepository.findByRoomIdAndUserId(roomId, userId).isPresent();
    }

    /**
     * Scheda profilo mostrata cliccando un avatar: aspetto, livello, rispetti, distintivi,
     * la carta migliore e la stanza da visitare. Niente email ne' gold.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> profile(UUID viewerId, UUID userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        List<UserCard> cards = userCardRepository.findByUserIdWithCard(userId).stream()
                .filter(uc -> uc.getQuantity() > 0).toList();

        Card best = cards.stream().map(UserCard::getCard)
                .max(Comparator.comparingInt((Card c) -> RARITY_ORDER.getOrDefault(c.getRarity(), 0))
                        .thenComparingDouble(c -> c.getMarketPrice() == null ? 0 : c.getMarketPrice()))
                .orElse(null);

        LocalDate today = LocalDate.now(clock);
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", user.getId());
        profile.put("username", user.getUsername());
        profile.put("look", HotelLook.orDefault(user.getHotelLook()));
        profile.put("level", user.getLevel());
        profile.put("respects", respectRepository.countByReceiverId(userId));
        profile.put("uniqueCards", cards.size());
        profile.put("battlesWon", user.getBattlesWon());
        profile.put("badges", badges(user, cards));
        profile.put("bestCard", best == null ? null : RoomItemView.CardView.from(best));
        profile.put("roomId", roomRepository.findFirstByOwnerIdOrderByCreatedAtAsc(userId).map(Room::getId).orElse(null));
        profile.put("respectsLeft", viewerId == null ? 0
                : (int) Math.max(0, DAILY_RESPECTS - respectRepository.countByGiverIdAndDay(viewerId, today)));
        profile.put("respectedToday", viewerId != null
                && respectRepository.existsByGiverIdAndReceiverIdAndDay(viewerId, userId, today));
        return profile;
    }

    /** Distintivi guadagnati giocando: si leggono da livello, collezione e battaglie. */
    static List<Map<String, String>> badges(User user, List<UserCard> cards) {
        List<Map<String, String>> badges = new ArrayList<>();
        int unique = cards.size();
        if (unique >= 100) badges.add(badge("collector3", "Grande collezionista", "100 carte diverse"));
        else if (unique >= 50) badges.add(badge("collector2", "Collezionista", "50 carte diverse"));
        else if (unique >= 10) badges.add(badge("collector1", "Primi passi", "10 carte diverse"));

        if (cards.stream().anyMatch(uc -> "legendary".equals(uc.getCard().getRarity()))) {
            badges.add(badge("legend", "Leggendario", "Possiede una carta leggendaria"));
        }
        if (user.getLevel() >= 20) badges.add(badge("level3", "Veterano", "Livello 20"));
        else if (user.getLevel() >= 10) badges.add(badge("level2", "Esperto", "Livello 10"));
        else if (user.getLevel() >= 5) badges.add(badge("level1", "In ascesa", "Livello 5"));

        if (user.getBattlesWon() >= 25) badges.add(badge("champion", "Campione", "25 battaglie vinte"));
        else if (user.getBattlesWon() >= 5) badges.add(badge("fighter", "Combattente", "5 battaglie vinte"));
        return badges;
    }

    private static Map<String, String> badge(String code, String name, String description) {
        return Map.of("code", code, "name", name, "description", description);
    }
}
