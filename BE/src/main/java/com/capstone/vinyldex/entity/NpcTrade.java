package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Uno scambio di carte fra un giocatore e un NPC dell'hotel in un certo giorno. */
@Entity
@Table(name = "hotel_npc_trades")
@Getter
@Setter
@NoArgsConstructor
public class NpcTrade {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "npc_name", nullable = false, length = 40)
    private String npcName;

    @Column(name = "gave_card_id", nullable = false)
    private UUID gaveCardId;

    @Column(name = "got_card_id", nullable = false)
    private UUID gotCardId;

    @Column(name = "day", nullable = false)
    private LocalDate day;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
