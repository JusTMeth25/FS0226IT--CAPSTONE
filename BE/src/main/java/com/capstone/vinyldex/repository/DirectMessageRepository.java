package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.DirectMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface DirectMessageRepository extends JpaRepository<DirectMessage, UUID> {

    /** Conversazione fra due utenti, dal messaggio piu' recente. */
    @Query("select m from DirectMessage m where (m.fromId = :a and m.toId = :b) or (m.fromId = :b and m.toId = :a) order by m.createdAt desc")
    List<DirectMessage> findThread(@Param("a") UUID a, @Param("b") UUID b, Pageable page);

    /** Messaggi non letti ricevuti dall'utente, per mittente: [fromId, conteggio]. */
    @Query("select m.fromId, count(m) from DirectMessage m where m.toId = :me and m.readAt is null group by m.fromId")
    List<Object[]> countUnread(@Param("me") UUID me);

    @Modifying
    @Query("update DirectMessage m set m.readAt = :now where m.toId = :me and m.fromId = :from and m.readAt is null")
    int markRead(@Param("me") UUID me, @Param("from") UUID from, @Param("now") Instant now);
}
