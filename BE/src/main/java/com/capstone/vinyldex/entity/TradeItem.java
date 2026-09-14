package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Una carta dentro uno scambio, con il verso che indica chi la cede. */
@Entity
@Table(name = "trade_items", indexes = @Index(name = "idx_trade_items_trade", columnList = "trade_id"))
@Getter
@Setter
@NoArgsConstructor
public class TradeItem {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trade_id", nullable = false, foreignKey = @ForeignKey(name = "fk_trade_items_trade"))
    private Trade trade;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "card_id", nullable = false, foreignKey = @ForeignKey(name = "fk_trade_items_card"))
    private Card card;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 20)
    private TradeItemDirection direction;

    public TradeItem(Trade trade, Card card, int quantity, TradeItemDirection direction) {
        this.trade = trade;
        this.card = card;
        this.quantity = quantity;
        this.direction = direction;
    }
}
