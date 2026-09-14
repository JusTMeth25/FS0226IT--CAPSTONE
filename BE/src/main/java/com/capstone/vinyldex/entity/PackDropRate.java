package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Peso di una rarita' nell'estrazione di un pacchetto. I pesi non devono sommare a 1: sono relativi. */
@Entity
@Table(name = "pack_drop_rates",
        uniqueConstraints = @UniqueConstraint(name = "uk_pack_drop_rates", columnNames = {"pack_id", "rarity"}))
@Getter
@Setter
@NoArgsConstructor
public class PackDropRate {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pack_id", nullable = false, foreignKey = @ForeignKey(name = "fk_pack_drop_rates_pack"))
    private Pack pack;

    @Column(name = "rarity", nullable = false, length = 50)
    private String rarity;

    @Column(name = "weight", nullable = false)
    private double weight;
}
