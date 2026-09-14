package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/** Esito dell'ultimo import per ogni API esterna di carte. */
@Entity
@Table(name = "external_card_sources")
@Getter
@Setter
@NoArgsConstructor
public class ExternalCardSource {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "source", nullable = false, unique = true, length = 50)
    private String source;

    @Column(name = "last_imported_at")
    private Instant lastImportedAt;

    @Column(name = "total_imported", nullable = false)
    private int totalImported = 0;

    @Column(name = "last_error", length = 2000)
    private String lastError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public ExternalCardSource(String source) {
        this.source = source;
    }
}
