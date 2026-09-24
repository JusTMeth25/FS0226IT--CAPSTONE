package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Partita conclusa fra due giocatori nell'hotel. */
@Entity
@Table(name = "pvp_matches")
@Getter
@Setter
@NoArgsConstructor
public class PvpMatch {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "player_a_id", nullable = false)
    private UUID playerAId;

    @Column(name = "player_b_id", nullable = false)
    private UUID playerBId;

    /** Null in caso di pareggio. */
    @Column(name = "winner_id")
    private UUID winnerId;

    @Column(name = "score_a", nullable = false)
    private int scoreA;

    @Column(name = "score_b", nullable = false)
    private int scoreB;

    /** "complete" se si sono giocati tutti i round, "forfeit" se qualcuno ha abbandonato. */
    @Column(name = "ended_by", nullable = false, length = 20)
    private String endedBy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rounds", columnDefinition = "jsonb")
    private List<Map<String, Object>> rounds;

    @Column(name = "rewarded_a", nullable = false)
    private boolean rewardedA;

    @Column(name = "rewarded_b", nullable = false)
    private boolean rewardedB;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
