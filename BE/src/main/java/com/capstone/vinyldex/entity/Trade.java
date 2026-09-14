package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Proposta di scambio fra due utenti: carte e gold in entrambe le direzioni. */
@Entity
@Table(name = "trades", indexes = {
        @Index(name = "idx_trades_from_user", columnList = "from_user_id"),
        @Index(name = "idx_trades_to_user", columnList = "to_user_id"),
        @Index(name = "idx_trades_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
public class Trade {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_trades_from_user"))
    private User fromUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_trades_to_user"))
    private User toUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private TradeStatus status = TradeStatus.PENDING;

    @Column(name = "offered_gold", nullable = false)
    private int offeredGold = 0;

    @Column(name = "requested_gold", nullable = false)
    private int requestedGold = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "trade", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TradeItem> items = new ArrayList<>();
}
