package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Animale da compagnia di un giocatore: tipo, nome e quando ha mangiato l'ultima volta. */
@Entity
@Table(name = "user_pets")
@Getter
@Setter
@NoArgsConstructor
public class UserPet {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "type", nullable = false, length = 20)
    private String type;

    @Column(name = "name", nullable = false, length = 20)
    private String name;

    @Column(name = "fed_at", nullable = false)
    private Instant fedAt;

    @Column(name = "adopted_at", nullable = false)
    private Instant adoptedAt;

    public UserPet(UUID userId, String type, String name) {
        this.userId = userId;
        this.type = type;
        this.name = name;
        this.fedAt = Instant.now();
        this.adoptedAt = Instant.now();
    }
}
