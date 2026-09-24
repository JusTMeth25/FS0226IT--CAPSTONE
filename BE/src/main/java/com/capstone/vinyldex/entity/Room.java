package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Stanza dell'hotel. Le stanze pubbliche non hanno proprietario; quelle personali si.
 * Lo stato "vivo" (chi c'e', dove si trova) non sta qui ma in memoria, in RoomInstance.
 */
@Entity
@Table(name = "rooms")
@Getter
@Setter
@NoArgsConstructor
public class Room {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(name = "name", nullable = false, length = 60)
    private String name;

    @Column(name = "description", length = 255)
    private String description;

    /** Mappa delle altezze: una riga per y, "x" vuoto, cifra = altezza della casella. */
    @Column(name = "layout", nullable = false, columnDefinition = "text")
    private String layout;

    @Column(name = "door_x", nullable = false)
    private int doorX;

    @Column(name = "door_y", nullable = false)
    private int doorY;

    @Column(name = "door_dir", nullable = false)
    private int doorDir = 2;

    @Column(name = "floor_style", nullable = false, length = 30)
    private String floorStyle = "neon";

    @Column(name = "wall_style", nullable = false, length = 30)
    private String wallStyle = "neon";

    /** "open" o "closed": in una stanza chiusa entra solo il proprietario. */
    @Column(name = "door_mode", nullable = false, length = 10)
    private String doorMode = "open";

    @Column(name = "max_users", nullable = false)
    private int maxUsers = 25;

    @Column(name = "is_public", nullable = false)
    private boolean publicRoom = false;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
