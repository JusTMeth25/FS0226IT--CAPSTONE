package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Slot di un album: quale carta serve per riempirlo. */
@Entity
@Table(name = "album_cards",
        uniqueConstraints = @UniqueConstraint(name = "uk_album_cards", columnNames = {"album_id", "card_id"}))
@Getter
@Setter
@NoArgsConstructor
public class AlbumCard {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "album_id", nullable = false, foreignKey = @ForeignKey(name = "fk_album_cards_album"))
    private Album album;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "card_id", nullable = false, foreignKey = @ForeignKey(name = "fk_album_cards_card"))
    private Card card;

    public AlbumCard(Album album, Card card) {
        this.album = album;
        this.card = card;
    }
}
