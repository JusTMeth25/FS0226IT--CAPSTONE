package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Carta trovata da un NPC in un pacchetto aperto nell'hotel: sta nella sua vetrina degli scambi. */
@Entity
@Table(name = "hotel_npc_found_cards")
@Getter
@Setter
@NoArgsConstructor
public class NpcFoundCard {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "npc_id", nullable = false)
    private UUID npcId;

    @Column(name = "card_id", nullable = false)
    private UUID cardId;

    @Column(name = "found_at", nullable = false)
    private Instant foundAt;

    public NpcFoundCard(UUID npcId, UUID cardId, Instant foundAt) {
        this.npcId = npcId;
        this.cardId = cardId;
        this.foundAt = foundAt;
    }
}
