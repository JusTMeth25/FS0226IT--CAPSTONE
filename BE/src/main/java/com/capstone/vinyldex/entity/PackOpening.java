package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Storico di una singola apertura, con le carte estratte. */
@Entity
@Table(name = "pack_openings", indexes = @Index(name = "idx_pack_openings_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class PackOpening {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_pack_openings_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pack_id", nullable = false, foreignKey = @ForeignKey(name = "fk_pack_openings_pack"))
    private Pack pack;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", nullable = false, length = 20)
    private PackOpenMode mode = PackOpenMode.PAID;

    @Column(name = "gold_spent", nullable = false)
    private int goldSpent = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "packOpening", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PackOpeningCard> cards = new ArrayList<>();
}
