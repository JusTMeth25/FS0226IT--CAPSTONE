package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.RoomItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomItemRepository extends JpaRepository<RoomItem, UUID> {

    @Query("SELECT i FROM RoomItem i LEFT JOIN FETCH i.card LEFT JOIN FETCH i.owner WHERE i.room.id = :roomId")
    List<RoomItem> findInRoom(UUID roomId);

    /** Inventario: mobili del proprietario non ancora posizionati in una stanza. */
    @Query("SELECT i FROM RoomItem i WHERE i.owner.id = :ownerId AND i.room IS NULL ORDER BY i.createdAt DESC")
    List<RoomItem> findInventory(UUID ownerId);

    @Query("SELECT i FROM RoomItem i LEFT JOIN FETCH i.card LEFT JOIN FETCH i.owner WHERE i.id = :id")
    Optional<RoomItem> findWithDetails(UUID id);

    long countByOwnerId(UUID ownerId);

    /** Quante copie di una carta il proprietario sta gia' esponendo, in tutte le sue stanze. */
    long countByOwnerIdAndCardId(UUID ownerId, UUID cardId);
}
