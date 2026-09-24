package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Room;

import java.util.UUID;

/**
 * Dati fissi di una stanza, copiati dall'entita' una volta al caricamento.
 * RoomInstance lavora su questa copia e non sull'entita' JPA, che fuori dalla transazione
 * non potrebbe piu' caricare il proprietario.
 */
public record RoomData(
        UUID id,
        String name,
        String description,
        UUID ownerId,
        String ownerName,
        String layout,
        int doorX,
        int doorY,
        int doorDir,
        String floorStyle,
        String wallStyle,
        String doorMode,
        int maxUsers,
        boolean publicRoom
) {

    public static RoomData from(Room room) {
        return new RoomData(
                room.getId(), room.getName(), room.getDescription(),
                room.getOwner() != null ? room.getOwner().getId() : null,
                room.getOwner() != null ? room.getOwner().getUsername() : null,
                room.getLayout(), room.getDoorX(), room.getDoorY(), room.getDoorDir(),
                room.getFloorStyle(), room.getWallStyle(), room.getDoorMode(), room.getMaxUsers(),
                room.isPublicRoom());
    }

    public boolean isOwner(UUID userId) {
        return ownerId != null && ownerId.equals(userId);
    }
}
