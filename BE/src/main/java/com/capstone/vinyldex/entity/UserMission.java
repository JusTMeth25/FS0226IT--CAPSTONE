package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Avanzamento di un utente su una missione.
 * completed = obiettivo raggiunto; claimed = ricompensa gia' incassata. Sono stati distinti:
 * il riscatto e' un'azione esplicita dell'utente.
 */
@Entity
@Table(name = "user_missions",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_missions", columnNames = {"user_id", "mission_id"}),
        indexes = @Index(name = "idx_user_missions_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class UserMission {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_missions_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mission_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_missions_mission"))
    private Mission mission;

    @Column(name = "progress", nullable = false)
    private int progress = 0;

    @Column(name = "completed", nullable = false)
    private boolean completed = false;

    @Column(name = "claimed", nullable = false)
    private boolean claimed = false;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    public UserMission(User user, Mission mission) {
        this.user = user;
        this.mission = mission;
    }
}
