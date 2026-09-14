package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/** Singola carta estratta in un'apertura. La rarita' e' congelata qui: se la carta cambia rarita' lo storico resta fedele. */
@Entity
@Table(name = "pack_opening_cards", indexes = @Index(name = "idx_pack_opening_cards_opening", columnList = "pack_opening_id"))
@Getter
@Setter
@NoArgsConstructor
public class PackOpeningCard {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pack_opening_id", nullable = false, foreignKey = @ForeignKey(name = "fk_pack_opening_cards_opening"))
    private PackOpening packOpening;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "card_id", nullable = false, foreignKey = @ForeignKey(name = "fk_pack_opening_cards_card"))
    private Card card;

    @Column(name = "rarity", nullable = false, length = 50)
    private String rarity;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public PackOpeningCard(PackOpening packOpening, Card card, String rarity) {
        this.packOpening = packOpening;
        this.card = card;
        this.rarity = rarity;
    }
}
