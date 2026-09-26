package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    /** Tutte le amicizie e le richieste in cui compare l'utente, da una parte o dall'altra. */
    @Query("select f from Friendship f where f.userId = :me or f.friendId = :me")
    List<Friendship> findAllOf(@Param("me") UUID me);

    /** La riga della coppia, in qualunque verso. */
    @Query("select f from Friendship f where (f.userId = :a and f.friendId = :b) or (f.userId = :b and f.friendId = :a)")
    Optional<Friendship> findPair(@Param("a") UUID a, @Param("b") UUID b);
}
