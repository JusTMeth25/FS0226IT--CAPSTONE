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

/** Evento a tempo: puo' alzare le probabilita' di drop e portare pacchetti o missioni dedicate. */
@Entity
@Table(name = "events", indexes = @Index(name = "idx_events_is_active", columnList = "is_active"))
@Getter
@Setter
@NoArgsConstructor
public class Event {

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

    @Column(name = "starts_at")
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "bonus_drop_rate_multiplier", nullable = false)
    private double bonusDropRateMultiplier = 1.0;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "event")
    private List<Pack> packs = new ArrayList<>();

    @OneToMany(mappedBy = "event")
    private List<Mission> missions = new ArrayList<>();

    /** Attivo e dentro la finestra temporale. Estremi assenti valgono come "senza limite". */
    public boolean isRunningAt(Instant now) {
        if (!active) return false;
        if (startsAt != null && now.isBefore(startsAt)) return false;
        return endsAt == null || !now.isAfter(endsAt);
    }
}
