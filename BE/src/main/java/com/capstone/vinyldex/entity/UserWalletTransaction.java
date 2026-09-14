package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Registro contabile dei gold. Riga append-only: non si aggiorna e non si cancella.
 * balanceAfter e' il saldo risultante, cosi' l'estratto conto e' ricostruibile senza ricalcoli.
 */
@Entity
@Table(name = "user_wallet_transactions", indexes = {
        @Index(name = "idx_wallet_tx_user", columnList = "user_id"),
        @Index(name = "idx_wallet_tx_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
public class UserWalletTransaction {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_wallet_tx_user"))
    private User user;

    /** Positivo per accredito, negativo per addebito. */
    @Column(name = "amount", nullable = false)
    private int amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 40)
    private WalletTransactionType type;

    @Column(name = "balance_after", nullable = false)
    private int balanceAfter;

    /** Id dell'entita' che ha causato il movimento (apertura, inserzione, scambio...). */
    @Column(name = "related_id", length = 100)
    private String relatedId;

    @Column(name = "note", length = 500)
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
