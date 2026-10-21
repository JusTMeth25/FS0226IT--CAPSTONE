package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.dto.response.AuthResponse;
import com.capstone.vinyldex.dto.response.AuthUserDto;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.security.AuthCookies;
import com.capstone.vinyldex.security.ClientIp;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.LoginThrottle;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.AuthService;
import com.capstone.vinyldex.service.PasswordResetService;
import com.capstone.vinyldex.service.TwoFactorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /**
     * Durata minima della risposta di "Non ricordo la password": con l'email registrata il server
     * fa qualche query in piu', e senza questa attesa i tempi direbbero quali email esistono.
     */
    private static final long FORGOT_MIN_MILLIS = 300;

    private final AuthService authService;
    private final AuthCookies cookies;
    private final LoginThrottle throttle;

    private PasswordResetService passwordReset;

    public AuthController(AuthService authService, AuthCookies cookies, LoginThrottle throttle) {
        this.authService = authService;
        this.cookies = cookies;
        this.throttle = throttle;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setPasswordReset(PasswordResetService passwordReset) {
        this.passwordReset = passwordReset;
    }

    /** Manda il link per reimpostare la password: risponde sempre ok, che l'email esista o no. */
    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Chiede il link per reimpostare la password",
            description = "Risponde sempre ok, che l'email esista o no, e sempre dopo lo stesso tempo minimo.")
    @SecurityRequirements
    @PostMapping("/forgot-password")
    public Map<String, Boolean> forgotPassword(@Valid @RequestBody AuthRequests.ForgotPasswordRequest request,
                                               HttpServletRequest http) {
        long started = System.nanoTime();
        String ip = ClientIp.of(http);
        try {
            throttle.checkIp(ip);
            passwordReset.request(request.email(), ip);
            return Map.of("sent", true);
        } finally {
            padTo(started, FORGOT_MIN_MILLIS);
        }
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Reimposta la password col token ricevuto per email")
    @SecurityRequirements
    @PostMapping("/reset-password")
    public Map<String, Boolean> resetPassword(@Valid @RequestBody AuthRequests.ResetPasswordRequest request,
                                              HttpServletRequest http) {
        throttle.checkIp(ClientIp.of(http));
        passwordReset.reset(request.token(), request.password());
        return Map.of("reset", true);
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Registra un nuovo utente")
    @SecurityRequirements
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody AuthRequests.RegisterRequest request,
                                                 HttpServletRequest http) {
        throttle.checkIp(ClientIp.of(http));
        return session(HttpStatus.CREATED, authService.register(request), http);
    }

    /**
     * Accesso con email e password, col freno ai tentativi (LoginThrottle): il blocco scatta
     * prima di guardare la password, e solo le password sbagliate fanno salire il contatore.
     */
    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Accesso con email e password",
            description = "Il token arriva nel cookie HttpOnly vinyldex_session; con l'header X-VinylDex-Client: native anche nel campo token del corpo (da copiare in Authorize). Con la verifica in due passaggi attiva risponde con un challenge da completare con POST /api/auth/2fa/verify. Troppi tentativi sbagliati: 429.")
    @SecurityRequirements
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequests.LoginRequest request,
                                              HttpServletRequest http) {
        String ip = ClientIp.of(http);
        throttle.checkIp(ip);
        throttle.checkLogin(ip, request.email());
        AuthResponse response;
        try {
            response = authService.login(request);
        } catch (ApiException ex) {
            if ("invalid_credentials".equals(ex.getCode())) throttle.failure(ip, request.email());
            throw ex;
        }
        throttle.success(ip, request.email());
        return session(HttpStatus.OK, response, http);
    }

    /** Esce: cancella il cookie di sessione (l'app nativa butta via il suo token da sola). */
    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Esce e cancella il cookie di sessione")
    @SecurityRequirements
    @PostMapping("/logout")
    public ResponseEntity<Map<String, Boolean>> logout() {
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.clear()).body(Map.of("loggedOut", true));
    }

    /** Fornitori di accesso attivi (Google, Apple) e i client id pubblici per i pulsanti. */
    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Fornitori di accesso attivi (Google, Apple)")
    @SecurityRequirements
    @GetMapping("/providers")
    public Map<String, Object> providers() {
        return authService.socialProviders();
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Accesso con Google o Apple")
    @SecurityRequirements
    @PostMapping("/social")
    public ResponseEntity<AuthResponse> social(@Valid @RequestBody AuthRequests.SocialLoginRequest request,
                                               HttpServletRequest http) {
        throttle.checkIp(ClientIp.of(http));
        return session(HttpStatus.OK, authService.socialLogin(request), http);
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Completa l'accesso col codice della verifica in due passaggi")
    @SecurityRequirements
    @PostMapping("/2fa/verify")
    public ResponseEntity<AuthResponse> verifySecondStep(@Valid @RequestBody AuthRequests.TwoFactorVerifyRequest request,
                                                         @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
                                                         HttpServletRequest http) {
        throttle.checkIp(ClientIp.of(http));
        return session(HttpStatus.OK, authService.verifySecondStep(request, deviceLabel(userAgent)), http);
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Stato della verifica in due passaggi")
    @GetMapping("/2fa")
    public Map<String, Object> twoFactorStatus(@CurrentUser UserPrincipal principal) {
        return authService.twoFactorStatus(principal.getId());
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Prepara la verifica in due passaggi (segreto e QR)")
    @PostMapping("/2fa/setup")
    public TwoFactorService.Setup twoFactorSetup(@CurrentUser UserPrincipal principal) {
        return authService.twoFactorSetup(principal.getId());
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Attiva la verifica in due passaggi")
    @PostMapping("/2fa/enable")
    public Map<String, Object> twoFactorEnable(@CurrentUser UserPrincipal principal,
                                               @Valid @RequestBody AuthRequests.TwoFactorCodeRequest request,
                                               @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        return authService.twoFactorEnable(principal.getId(), request.code(), deviceLabel(userAgent));
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Disattiva la verifica in due passaggi")
    @PostMapping("/2fa/disable")
    public Map<String, AuthUserDto> twoFactorDisable(@CurrentUser UserPrincipal principal,
                                                     @Valid @RequestBody AuthRequests.TwoFactorCodeRequest request) {
        return Map.of("user", authService.twoFactorDisable(principal.getId(), request.code()));
    }

    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Genera nuovi codici di riserva")
    @PostMapping("/2fa/backup-codes")
    public Map<String, Object> twoFactorBackupCodes(@CurrentUser UserPrincipal principal,
                                                    @Valid @RequestBody AuthRequests.TwoFactorCodeRequest request) {
        return Map.of("backupCodes", authService.twoFactorBackupCodes(principal.getId(), request.code()));
    }

    /** Dimentica gli altri dispositivi fidati: al prossimo accesso da li' serve di nuovo il codice. */
    @Tag(name = Tags.AUTH, description = Tags.AUTH_INFO)
    @Operation(summary = "Dimentica gli altri dispositivi fidati")
    @PostMapping("/2fa/forget-devices")
    public Map<String, Integer> forgetDevices(@CurrentUser UserPrincipal principal,
                                              @Valid @RequestBody AuthRequests.ForgetDevicesRequest request) {
        return Map.of("forgotten", authService.forgetOtherDevices(principal.getId(), request.deviceToken()));
    }

    /**
     * Risposta di un accesso riuscito. Il sito riceve il token solo nel cookie HttpOnly (il corpo
     * non lo contiene); l'app nativa lo riceve nel corpo. Il challenge della verifica
     * in due passaggi non e' un token di accesso: passa invariato.
     */
    private ResponseEntity<AuthResponse> session(HttpStatus status, AuthResponse response, HttpServletRequest http) {
        if (response.token() == null) return ResponseEntity.status(status).body(response);
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookies.issue(response.token()))
                .body(AuthCookies.isNative(http) ? response : response.withoutToken());
    }

    /** Aspetta quanto manca perche' la risposta duri almeno minMillis. */
    private static void padTo(long startedNanos, long minMillis) {
        long left = minMillis - (System.nanoTime() - startedNanos) / 1_000_000;
        if (left <= 0) return;
        try {
            Thread.sleep(left);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

    /** Nome leggibile del dispositivo fidato ("Chrome su Windows"), dallo User-Agent. */
    static String deviceLabel(String userAgent) {
        if (userAgent == null) return null;
        String ua = userAgent.toLowerCase();
        String app = ua.contains("edg/") ? "Edge" : ua.contains("firefox") ? "Firefox" : ua.contains("chrome") ? "Chrome"
                : ua.contains("safari") ? "Safari" : "Browser";
        String os = ua.contains("android") ? "Android" : ua.contains("iphone") || ua.contains("ipad") ? "iOS"
                : ua.contains("windows") ? "Windows" : ua.contains("mac os") ? "macOS" : ua.contains("linux") ? "Linux" : "";
        return os.isEmpty() ? app : app + " su " + os;
    }

    @Tag(name = Tags.PROFILO, description = Tags.PROFILO_INFO)
    @Operation(summary = "Profilo dell'utente collegato")
    @GetMapping("/profile")
    public Map<String, AuthUserDto> profile(@CurrentUser UserPrincipal principal) {
        return Map.of("user", authService.getProfile(principal.getId()));
    }

    @Tag(name = Tags.PROFILO, description = Tags.PROFILO_INFO)
    @Operation(summary = "Cambia l'avatar")
    @PatchMapping("/avatar")
    public Map<String, AuthUserDto> updateAvatar(@CurrentUser UserPrincipal principal,
                                                 @Valid @RequestBody AuthRequests.AvatarRequest request) {
        return Map.of("user", authService.updateAvatar(principal.getId(), request.avatar()));
    }

    /** Aspetto dell'avatar nell'hotel, scelto dal guardaroba. */
    @Tag(name = Tags.PROFILO, description = Tags.PROFILO_INFO)
    @Operation(summary = "Cambia l'aspetto dell'avatar nell'hotel")
    @PatchMapping("/look")
    public Map<String, AuthUserDto> updateLook(@CurrentUser UserPrincipal principal,
                                               @Valid @RequestBody AuthRequests.LookRequest request) {
        return Map.of("user", authService.updateLook(principal.getId(), request.look()));
    }
}
