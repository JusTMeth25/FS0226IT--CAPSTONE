package com.capstone.vinyldex.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Account di gioco. Il saldo gold non va mai aggiornato direttamente da un controller:
 * ogni variazione passa da WalletService, che rilegge il saldo e registra il movimento.
 */
@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_email", columnList = "email"),
        @Index(name = "idx_users_username", columnList = "username"),
        @Index(name = "idx_users_battles_won", columnList = "battles_won")
})
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "gold", nullable = false)
    private int gold = 150;

    @Column(name = "xp", nullable = false)
    private int xp = 0;

    @Column(name = "level", nullable = false)
    private int level = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role = UserRole.USER;

    @Column(name = "avatar", length = 50)
    private String avatar;

    /** Aspetto dell'avatar nell'hotel (vedi HotelLook). Null = aspetto predefinito. */
    @Column(name = "hotel_look", length = 64)
    private String hotelLook;

    /** Account di un NPC dell'hotel (asta, eventi, tornei): niente accesso, fuori dalle classifiche. */
    @Column(name = "is_npc", nullable = false)
    private boolean npc = false;

    /** Pacchetti aperti di fila senza una leggendaria (pity counter, vedi PackGenerator). */
    @Column(name = "pack_pity", nullable = false)
    private int packPity = 0;

    /** Distintivo mostrato accanto al nome nell'hotel (codice, vedi HotelSocialService). */
    @Column(name = "worn_badge", length = 80)
    private String wornBadge;

    /**
     * Carte scelte per stare sopra la testa dell'avatar nell'hotel: codici separati da virgola,
     * al massimo tre. Null = scelte in automatico (HotelSocialService.top).
     */
    @Column(name = "hotel_top_cards", length = 400)
    private String hotelTopCards;

    /** La guida dell'hotel si e' gia' presentata (tutorial della prima visita). */
    @Column(name = "hotel_tutorial_done", nullable = false)
    private boolean hotelTutorialDone = false;

    @Column(name = "banned", nullable = false)
    private boolean banned = false;

    @Column(name = "ban_reason", length = 500)
    private String banReason;

    /** Ultima apertura del pacchetto gratuito, per calcolare il cooldown. */
    @Column(name = "last_free_pack_at")
    private Instant lastFreePackAt;

    /** Solo la data: il bonus di login giornaliero scatta una volta per giorno di calendario. */
    @Column(name = "last_login_date")
    private LocalDate lastLoginDate;

    @Column(name = "login_streak", nullable = false)
    private int loginStreak = 0;

    @Column(name = "battles_won", nullable = false)
    private int battlesWon = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserCard> userCards = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserMission> userMissions = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserPackCredit> packCredits = new ArrayList<>();

    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }
}
