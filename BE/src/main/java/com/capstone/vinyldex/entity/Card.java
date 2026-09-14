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

/**
 * Carta del catalogo. L'identificativo pubblico esposto al frontend e' {@code code},
 * non lo UUID interno: e' stabile e leggibile, e coincide con i dati demo locali.
 */
@Entity
@Table(name = "cards",
        uniqueConstraints = @UniqueConstraint(name = "uk_cards_source_external_id", columnNames = {"source", "external_id"}),
        indexes = {
                @Index(name = "idx_cards_code", columnList = "code"),
                @Index(name = "idx_cards_rarity", columnList = "rarity"),
                @Index(name = "idx_cards_source", columnList = "source"),
                @Index(name = "idx_cards_is_active", columnList = "is_active")
        })
@Getter
@Setter
@NoArgsConstructor
public class Card {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 255)
    private String code;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "artist_class_id", foreignKey = @ForeignKey(name = "fk_cards_artist_class"))
    private ArtistClass artistClass;

    @Column(name = "variant", length = 100)
    private String variant;

    /** "group" e' parola riservata in SQL: la colonna e' rinominata card_group. */
    @Column(name = "card_group", length = 255)
    private String group;

    @Column(name = "rarity", nullable = false, length = 50)
    private String rarity;

    @Column(name = "img_url", length = 1000)
    private String imgUrl;

    @Column(name = "full_image", nullable = false)
    private boolean fullImage = false;

    @Column(name = "fans", nullable = false)
    private int fans = 0;

    @Column(name = "style", nullable = false)
    private int style = 0;

    @Column(name = "influence", nullable = false)
    private int influence = 0;

    @Column(name = "energy", nullable = false)
    private int energy = 0;

    @Column(name = "description", length = 4000)
    private String description;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** "original" per le carte disegnate in casa, altrimenti il nome dell'API di provenienza. */
    @Column(name = "source", nullable = false, length = 50)
    private String source = "original";

    @Column(name = "external_id", length = 255)
    private String externalId;

    @Column(name = "set_name", length = 255)
    private String setName;

    @Column(name = "set_code", length = 100)
    private String setCode;

    @Column(name = "number", length = 50)
    private String number;

    /** Payload libero dell'import: contiene fra l'altro marketPrice. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata = new HashMap<>();

    /** Prezzo di mercato letto da metadata, null se l'import non lo ha fornito. */
    public Double getMarketPrice() {
        if (metadata == null) return null;
        Object raw = metadata.get("marketPrice");
        return raw instanceof Number n ? n.doubleValue() : null;
    }
}
