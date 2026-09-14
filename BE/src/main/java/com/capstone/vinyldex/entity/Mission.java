package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Obiettivo assegnabile. Il campo type indica quale contatore fa avanzare il progresso. */
@Entity
@Table(name = "missions", indexes = @Index(name = "idx_missions_is_active", columnList = "is_active"))
@Getter
@Setter
@NoArgsConstructor
public class Mission {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 100)
    private String code;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", length = 1000)
    private String description;

    /** Es. OPEN_PACKS, COLLECT_CARDS, WIN_BATTLES: vedi MissionType. */
    @Column(name = "type", nullable = false, length = 50)
    private String type;

    @Column(name = "target_value", nullable = false)
    private int targetValue;

    @Column(name = "reward_gold", nullable = false)
    private int rewardGold = 0;

    @Column(name = "reward_xp", nullable = false)
    private int rewardXp = 0;

    /** Codice del pacchetto regalato al riscatto, null se la missione non ne da' nessuno. */
    @Column(name = "reward_pack", length = 100)
    private String rewardPack;

    @Column(name = "is_daily", nullable = false)
    private boolean daily = false;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", foreignKey = @ForeignKey(name = "fk_missions_event"))
    private Event event;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata = new HashMap<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
