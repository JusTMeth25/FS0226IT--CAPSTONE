package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Numero minimo di carte di una certa rarita' garantite in ogni apertura del pacchetto. */
@Entity
@Table(name = "pack_guarantees",
        uniqueConstraints = @UniqueConstraint(name = "uk_pack_guarantees", columnNames = {"pack_id", "rarity"}))
@Getter
@Setter
@NoArgsConstructor
public class PackGuarantee {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pack_id", nullable = false, foreignKey = @ForeignKey(name = "fk_pack_guarantees_pack"))
    private Pack pack;

    @Column(name = "rarity", nullable = false, length = 50)
    private String rarity;

    @Column(name = "count", nullable = false)
    private int count;
}
