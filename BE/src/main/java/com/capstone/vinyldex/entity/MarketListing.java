package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Inserzione sul mercato. Le carte messe in vendita sono gia' scalate dalla collezione
 * del venditore al momento della pubblicazione: annullare l'inserzione le restituisce.
 */
@Entity
@Table(name = "market_listings", indexes = {
        @Index(name = "idx_market_listings_status", columnList = "status"),
        @Index(name = "idx_market_listings_seller", columnList = "seller_id"),
        @Index(name = "idx_market_listings_card", columnList = "card_id")
})
@Getter
@Setter
@NoArgsConstructor
public class MarketListing {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id", nullable = false, foreignKey = @ForeignKey(name = "fk_market_listings_seller"))
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "card_id", nullable = false, foreignKey = @ForeignKey(name = "fk_market_listings_card"))
    private Card card;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Column(name = "price_per_unit", nullable = false)
    private int pricePerUnit;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MarketListingStatus status = MarketListingStatus.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public int totalPrice() {
        return quantity * pricePerUnit;
    }
}
