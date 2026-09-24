package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Room;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.RoomItemRepository;
import com.capstone.vinyldex.repository.RoomRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Lettura delle stanze dal database e navigatore dell'hotel. */
@Service
public class RoomService {

    /** Stanza personale di partenza: 10x9 caselle, porta sulla parete sinistra. */
    static final String PERSONAL_LAYOUT = String.join("\n",
            "xxxxxxxxxxx",
            "x0000000000",
            "x0000000000",
            "x0000000000",
            "00000000000",
            "x0000000000",
            "x0000000000",
            "x0000000000",
            "x0000000000",
            "x0000000000");

    private static final int MAX_NAME = 60;
    private static final int MAX_DESCRIPTION = 255;

    private final RoomRepository roomRepository;
    private final RoomItemRepository itemRepository;
    private final UserRepository userRepository;
    private final RoomRegistry roomRegistry;

    public RoomService(RoomRepository roomRepository, RoomItemRepository itemRepository,
                       UserRepository userRepository, RoomRegistry roomRegistry) {
        this.roomRepository = roomRepository;
        this.itemRepository = itemRepository;
        this.userRepository = userRepository;
        this.roomRegistry = roomRegistry;
    }

    @Transactional(readOnly = true)
    public List<RoomItemView> loadItems(UUID roomId) {
        return itemRepository.findInRoom(roomId).stream().map(RoomItemView::from).toList();
    }

    /** La stanza personale dell'utente, creata alla prima richiesta. */
    @Transactional
    public RoomData ensureMyRoom(UUID userId) {
        return roomRepository.findFirstByOwnerIdOrderByCreatedAtAsc(userId)
                .map(RoomData::from)
                .orElseGet(() -> {
                    User owner = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
                    Room room = new Room();
                    room.setOwner(owner);
                    room.setName("Stanza di " + owner.getUsername());
                    room.setDescription("Benvenuti nella mia collezione!");
                    room.setLayout(PERSONAL_LAYOUT);
                    room.setDoorX(0);
                    room.setDoorY(4);
                    room.setDoorDir(2);
                    room.setMaxUsers(20);
                    return RoomData.from(roomRepository.save(room));
                });
    }

    /** Nome, descrizione, porta e capienza: solo il proprietario. Le modifiche arrivano subito ai presenti. */
    @Transactional
    public RoomData updateSettings(UUID userId, UUID roomId, String name, String description, String doorMode, Integer maxUsers) {
        Room room = roomRepository.findWithOwner(roomId).orElseThrow(() -> ApiException.notFound("room_not_found"));
        if (room.getOwner() == null || !room.getOwner().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "not_your_room");
        }

        if (name != null) {
            String clean = ChatFilter.strip(name);
            if (clean.isEmpty()) throw ApiException.badRequest("invalid_room_name");
            room.setName(clean.length() > MAX_NAME ? clean.substring(0, MAX_NAME) : clean);
        }
        if (description != null) {
            String clean = ChatFilter.strip(description);
            room.setDescription(clean.length() > MAX_DESCRIPTION ? clean.substring(0, MAX_DESCRIPTION) : clean);
        }
        if (doorMode != null) {
            if (!doorMode.equals("open") && !doorMode.equals("closed")) throw ApiException.badRequest("invalid_door_mode");
            room.setDoorMode(doorMode);
        }
        if (maxUsers != null) room.setMaxUsers(Math.max(1, Math.min(25, maxUsers)));

        RoomData data = RoomData.from(roomRepository.save(room));
        RoomInstance live = roomRegistry.get(roomId);
        if (live != null) live.updateData(data);
        return data;
    }

    @Transactional(readOnly = true)
    public Optional<RoomData> load(UUID roomId) {
        return roomRepository.findWithOwner(roomId).map(RoomData::from);
    }

    /**
     * Navigatore: stanze pubbliche nell'ordine deciso a mano, poi le stanze dei giocatori con
     * dentro piu' persone. Il conteggio dei presenti viene dalle stanze vive in memoria.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> navigator() {
        List<Map<String, Object>> publicRooms = new ArrayList<>();
        for (Room room : roomRepository.findByPublicRoomTrueOrderBySortOrderAsc()) {
            publicRooms.add(summary(room));
        }

        List<Map<String, Object>> userRooms = new ArrayList<>();
        for (Room room : roomRepository.findUserRoomsWithOwner()) {
            userRooms.add(summary(room));
        }
        userRooms.sort(Comparator.comparingInt((Map<String, Object> r) -> (int) r.get("users")).reversed());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("publicRooms", publicRooms);
        result.put("userRooms", userRooms.size() > 30 ? userRooms.subList(0, 30) : userRooms);
        return result;
    }

    private Map<String, Object> summary(Room room) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", room.getId());
        summary.put("name", room.getName());
        summary.put("description", room.getDescription());
        summary.put("ownerName", room.getOwner() != null ? room.getOwner().getUsername() : null);
        summary.put("doorMode", room.getDoorMode());
        summary.put("maxUsers", room.getMaxUsers());
        summary.put("users", roomRegistry.userCount(room.getId()));
        summary.put("ownerId", room.getOwner() != null ? room.getOwner().getId() : null);
        return summary;
    }
}
