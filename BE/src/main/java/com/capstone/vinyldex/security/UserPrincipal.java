package com.capstone.vinyldex.security;

import com.capstone.vinyldex.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Utente autenticato per Spring Security. Avvolge l'entita' ricaricata dal database a ogni
 * richiesta, cosi' ruolo e stato di ban sono quelli correnti e non quelli congelati nel token.
 */
public record UserPrincipal(User user) implements UserDetails {

    public UUID getId() {
        return user.getId();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    @Override
    public boolean isAccountNonLocked() {
        return !user.isBanned();
    }

    @Override
    public boolean isEnabled() {
        return !user.isBanned();
    }
}
