package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/** Amicizia (o richiesta di amicizia) fra due giocatori dell'hotel. */
@Entity
@Table(name = "hotel_friendships")
@Getter
@Setter
@NoArgsConstructor
public class Friendship {

    public static final String PENDING = "PENDING";
    public static final String ACCEPTED = "ACCEPTED";

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** Chi ha mandato la richiesta. */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Chi l'ha ricevuta. */
    @Column(name = "friend_id", nullable = false)
    private UUID friendId;

    @Column(name = "status", nullable = false, length = 10)
    private String status = PENDING;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Friendship(UUID userId, UUID friendId) {
        this.userId = userId;
        this.friendId = friendId;
    }

    /** L'altro della coppia, visto da `me`. */
    public UUID other(UUID me) {
        return me.equals(userId) ? friendId : userId;
    }
}
