package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Un "rispetto" dato da un giocatore a un altro in un certo giorno. */
@Entity
@Table(name = "user_respects")
@Getter
@Setter
@NoArgsConstructor
public class UserRespect {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "giver_id", nullable = false)
    private UUID giverId;

    @Column(name = "receiver_id", nullable = false)
    private UUID receiverId;

    @Column(name = "day", nullable = false)
    private LocalDate day;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
