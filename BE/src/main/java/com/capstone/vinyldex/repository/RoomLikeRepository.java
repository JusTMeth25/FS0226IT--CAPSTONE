package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.RoomLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomLikeRepository extends JpaRepository<RoomLike, UUID> {

    long countByRoomId(UUID roomId);

    Optional<RoomLike> findByRoomIdAndUserId(UUID roomId, UUID userId);

    /** Conteggi di tutte le stanze in una query sola, per il navigatore. */
    @Query("SELECT l.roomId AS roomId, COUNT(l) AS likes FROM RoomLike l GROUP BY l.roomId")
    List<LikeCount> countAll();

    interface LikeCount {
        UUID getRoomId();

        long getLikes();
    }
}
