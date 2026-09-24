package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Room;
import com.capstone.vinyldex.repository.RoomRepository;
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

    private final RoomRepository roomRepository;
    private final RoomRegistry roomRegistry;

    public RoomService(RoomRepository roomRepository, RoomRegistry roomRegistry) {
        this.roomRepository = roomRepository;
        this.roomRegistry = roomRegistry;
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
        return summary;
    }
}
