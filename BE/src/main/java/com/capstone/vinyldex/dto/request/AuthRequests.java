package com.capstone.vinyldex.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Corpi delle richieste di autenticazione. */
public final class AuthRequests {

    private AuthRequests() {
    }

    public record RegisterRequest(
            @NotBlank(message = "missing_fields")
            @Size(min = 3, max = 50, message = "invalid_username")
            @Pattern(regexp = "^[A-Za-z0-9_.-]+$", message = "invalid_username")
            String username,

            @NotBlank(message = "missing_fields")
            @Email(message = "invalid_email")
            @Size(max = 255, message = "invalid_email")
            String email,

            // Otto caratteri e' il minimo che chiediamo: la password viene sempre salvata come hash BCrypt.
            @NotBlank(message = "missing_fields")
            @Size(min = 8, max = 100, message = "weak_password")
            String password
    ) {
    }

    public record LoginRequest(
            @NotBlank(message = "missing_fields") String email,
            @NotBlank(message = "missing_fields") String password
    ) {
    }

    public record AvatarRequest(
            @NotBlank(message = "invalid_avatar") String avatar
    ) {
    }
}
