package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/** Riga di collezione: quante copie di una carta possiede un utente. */
@Entity
@Table(name = "user_cards",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_cards_user_card", columnNames = {"user_id", "card_id"}),
        indexes = @Index(name = "idx_user_cards_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class UserCard {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_cards_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "card_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_cards_card"))
    private Card card;

    @CreationTimestamp
    @Column(name = "obtained_at", nullable = false, updatable = false)
    private Instant obtainedAt;

    @Column(name = "is_favorite", nullable = false)
    private boolean favorite = false;

    @Column(name = "quantity", nullable = false)
    private int quantity = 1;

    /** Volte in cui la carta e' stata schierata in battaglia (sito e hotel). */
    @Column(name = "battles_used", nullable = false)
    private int battlesUsed = 0;

    /** Copie olografiche fra quelle possedute. */
    @Column(name = "foil_count", nullable = false)
    private int foilCount = 0;

    /** Voto del perito (1-10), null se la carta non e' stata gradata. */
    @Column(name = "grade")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.SMALLINT)
    private Integer grade;

    @Column(name = "graded_at")
    private Instant gradedAt;

    public UserCard(User user, Card card, int quantity) {
        this.user = user;
        this.card = card;
        this.quantity = quantity;
    }
}
