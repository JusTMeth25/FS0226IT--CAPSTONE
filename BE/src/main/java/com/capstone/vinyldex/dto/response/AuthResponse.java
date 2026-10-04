package com.capstone.vinyldex.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Risposta di register, login e accesso con Google o Apple.
 *
 * Di solito: profilo piu' token da salvare lato client. Con la verifica in due passaggi attiva e un
 * dispositivo non ancora fidato arriva invece {@code twoFactorRequired} con un {@code challenge}
 * da rimandare insieme al codice a 6 cifre. {@code deviceToken} arriva quando il dispositivo
 * diventa fidato: il client lo conserva e lo rimanda ai login successivi.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(AuthUserDto user, String token, Boolean twoFactorRequired, String challenge, String deviceToken) {

    public AuthResponse(AuthUserDto user, String token) {
        this(user, token, null, null, null);
    }

    public static AuthResponse challenge(String challenge) {
        return new AuthResponse(null, null, true, challenge, null);
    }

    public AuthResponse withDevice(String device) {
        return new AuthResponse(user, token, twoFactorRequired, challenge, device);
    }
}
