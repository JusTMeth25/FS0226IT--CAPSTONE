package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Pacchetti regalati da missioni, livelli o eventi: si aprono senza spendere gold. */
@Entity
@Table(name = "user_pack_credits",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_pack_credits", columnNames = {"user_id", "pack_code"}))
@Getter
@Setter
@NoArgsConstructor
public class UserPackCredit {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_pack_credits_user"))
    private User user;

    @Column(name = "pack_code", nullable = false, length = 100)
    private String packCode;

    @Column(name = "quantity", nullable = false)
    private int quantity = 0;

    public UserPackCredit(User user, String packCode, int quantity) {
        this.user = user;
        this.packCode = packCode;
        this.quantity = quantity;
    }
}
