package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/** Messaggio privato fra due amici dell'hotel. */
@Entity
@Table(name = "hotel_direct_messages")
@Getter
@Setter
@NoArgsConstructor
public class DirectMessage {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "from_id", nullable = false)
    private UUID fromId;

    @Column(name = "to_id", nullable = false)
    private UUID toId;

    @Column(name = "text", nullable = false, length = 300)
    private String text;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    public DirectMessage(UUID fromId, UUID toId, String text) {
        this.fromId = fromId;
        this.toId = toId;
        this.text = text;
    }
}
