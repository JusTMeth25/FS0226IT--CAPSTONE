package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByUsername(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsername(String username);

    List<User> findAllByOrderByCreatedAtDesc();

    /** Classifica gold: solo utenti non bannati. */
    List<User> findByBannedFalseAndNpcFalseOrderByGoldDesc(Limit limit);

    /** Classifica battaglie: esclude chi non ne ha ancora vinta nessuna. */
    List<User> findByBannedFalseAndNpcFalseAndBattlesWonGreaterThanOrderByBattlesWonDesc(int minWins, Limit limit);

    /** Gli account degli NPC dell'hotel. */
    List<User> findByNpcTrue();


    /**
     * Riga bloccata in scrittura fino a fine transazione.
     * Serve a ogni movimento di gold: senza il lock due operazioni concorrenti leggerebbero
     * lo stesso saldo e l'ultima sovrascriverebbe l'altra.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") UUID id);

    /** Il destinatario di uno scambio puo' essere indicato per username oppure per id. */
    @Query("SELECT u FROM User u WHERE u.username = :handle OR CAST(u.id AS string) = :handle")
    Optional<User> findByUsernameOrId(@Param("handle") String handle);
}
