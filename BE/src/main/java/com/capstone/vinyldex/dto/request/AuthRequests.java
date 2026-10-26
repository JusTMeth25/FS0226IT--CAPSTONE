package com.capstone.vinyldex.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Corpi delle richieste di autenticazione. */
public final class AuthRequests {

    /**
     * Forma di un'email: niente spazi, un solo @, dominio con almeno un punto e suffisso di 2+
     * lettere. Si aggiunge a @Email, che da sola accetta anche "a@b".
     */
    public static final String EMAIL_REGEX = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}$";

    private AuthRequests() {
    }

    public record RegisterRequest(
            @NotBlank(message = "missing_fields")
            @Size(min = 3, max = 50, message = "invalid_username")
            @Pattern(regexp = "^[A-Za-z0-9_.-]+$", message = "invalid_username")
            String username,

            @NotBlank(message = "missing_fields")
            @Email(message = "invalid_email")
            @Pattern(regexp = EMAIL_REGEX, message = "invalid_email")
            @Size(max = 255, message = "invalid_email")
            String email,

            // Otto caratteri e' il minimo che chiediamo: la password viene sempre salvata come hash BCrypt.
            @NotBlank(message = "missing_fields")
            @Size(min = 8, max = 100, message = "weak_password")
            String password
    ) {
    }

    /** "Non ricordo la password": l'email dell'account. */
    public record ForgotPasswordRequest(
            @NotBlank(message = "missing_fields") @Size(max = 255, message = "invalid_email")
            @Pattern(regexp = EMAIL_REGEX, message = "invalid_email") String email
    ) {
    }

    /** Password nuova col token del link arrivato via email (stesse regole della registrazione). */
    public record ResetPasswordRequest(
            @NotBlank(message = "reset_token_invalid") @Size(max = 200, message = "reset_token_invalid") String token,
            @NotBlank(message = "missing_fields") @Size(min = 8, max = 100, message = "weak_password") String password
    ) {
    }

    /** {@code deviceToken}: token del dispositivo fidato, se il client ne ha uno (salta il codice a 6 cifre). */
    public record LoginRequest(
            @NotBlank(message = "missing_fields") String email,
            @NotBlank(message = "missing_fields") String password,
            @Size(max = 200) String deviceToken
    ) {
        public LoginRequest(String email, String password) {
            this(email, password, null);
        }
    }

    /** Accesso con Google o Apple: l'ID token avuto dal fornitore e, solo da Apple al primo accesso, il nome. */
    public record SocialLoginRequest(
            @NotBlank(message = "missing_fields")
            @Pattern(regexp = "google|apple", message = "provider_disabled")
            String provider,
            @NotBlank(message = "missing_fields") @Size(max = 8000) String idToken,
            @Size(max = 100) String name,
            @Size(max = 200) String deviceToken
    ) {
    }

    /** Secondo passaggio: il challenge del login piu' il codice a 6 cifre (o di emergenza). */
    public record TwoFactorVerifyRequest(
            @NotBlank(message = "missing_fields") @Size(max = 2000) String challenge,
            @NotBlank(message = "missing_fields") @Size(max = 20) String code,
            boolean remember
    ) {
    }

    public record TwoFactorCodeRequest(
            @NotBlank(message = "missing_fields") @Size(max = 20) String code
    ) {
    }

    /** Elimina account: username per intero, password (non per chi usa solo Google o Apple), codice se c'e' la 2FA. */
    public record DeleteAccountRequest(
            @NotBlank(message = "missing_fields") @Size(max = 50) String username,
            @Size(max = 100) String password,
            @Size(max = 20) String code
    ) {
    }

    public record ForgetDevicesRequest(@Size(max = 200) String deviceToken) {
    }

    public record AvatarRequest(
            @NotBlank(message = "invalid_avatar") String avatar
    ) {
    }

    /** Aspetto dell'avatar nell'hotel, validato da HotelLook. */
    public record LookRequest(
            @NotBlank(message = "invalid_look") String look
    ) {
    }
}
