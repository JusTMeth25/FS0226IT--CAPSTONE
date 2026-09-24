package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    List<Room> findByPublicRoomTrueOrderBySortOrderAsc();

    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.owner WHERE r.id = :id")
    Optional<Room> findWithOwner(UUID id);

    Optional<Room> findFirstByOwnerIdOrderByCreatedAtAsc(UUID ownerId);

    @Query("SELECT r FROM Room r JOIN FETCH r.owner WHERE r.publicRoom = false ORDER BY r.createdAt DESC")
    List<Room> findUserRoomsWithOwner();
}
