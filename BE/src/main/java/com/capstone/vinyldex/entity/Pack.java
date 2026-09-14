package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/** Bustina acquistabile. Le probabilita' di uscita stanno in PackDropRate, i minimi garantiti in PackGuarantee. */
@Entity
@Table(name = "packs")
@Getter
@Setter
@NoArgsConstructor
public class Pack {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 100)
    private String code;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "price_gold", nullable = false)
    private int priceGold;

    @Column(name = "card_count", nullable = false)
    private int cardCount;

    @Column(name = "is_free", nullable = false)
    private boolean free = false;

    @Column(name = "free_cooldown_hours", nullable = false)
    private int freeCooldownHours = 0;

    @Column(name = "img_url", length = 1000)
    private String imgUrl;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", foreignKey = @ForeignKey(name = "fk_packs_event"))
    private Event event;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "pack", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<PackDropRate> dropRates = new LinkedHashSet<>();

    @OneToMany(mappedBy = "pack", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<PackGuarantee> guarantees = new LinkedHashSet<>();
}
