package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.dto.response.AuthResponse;
import com.capstone.vinyldex.dto.response.AuthUserDto;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.AuthService;
import com.capstone.vinyldex.service.TwoFactorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody AuthRequests.RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody AuthRequests.LoginRequest request) {
        return authService.login(request);
    }

    /** Fornitori di accesso attivi (Google, Apple) e i client id pubblici per i pulsanti. */
    @GetMapping("/providers")
    public Map<String, Object> providers() {
        return authService.socialProviders();
    }

    @PostMapping("/social")
    public AuthResponse social(@Valid @RequestBody AuthRequests.SocialLoginRequest request) {
        return authService.socialLogin(request);
    }

    @PostMapping("/2fa/verify")
    public AuthResponse verifySecondStep(@Valid @RequestBody AuthRequests.TwoFactorVerifyRequest request,
                                         @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        return authService.verifySecondStep(request, deviceLabel(userAgent));
    }

    @GetMapping("/2fa")
    public Map<String, Object> twoFactorStatus(@CurrentUser UserPrincipal principal) {
        return authService.twoFactorStatus(principal.getId());
    }

    @PostMapping("/2fa/setup")
    public TwoFactorService.Setup twoFactorSetup(@CurrentUser UserPrincipal principal) {
        return authService.twoFactorSetup(principal.getId());
    }

    @PostMapping("/2fa/enable")
    public Map<String, Object> twoFactorEnable(@CurrentUser UserPrincipal principal,
                                               @Valid @RequestBody AuthRequests.TwoFactorCodeRequest request,
                                               @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        return authService.twoFactorEnable(principal.getId(), request.code(), deviceLabel(userAgent));
    }

    @PostMapping("/2fa/disable")
    public Map<String, AuthUserDto> twoFactorDisable(@CurrentUser UserPrincipal principal,
                                                     @Valid @RequestBody AuthRequests.TwoFactorCodeRequest request) {
        return Map.of("user", authService.twoFactorDisable(principal.getId(), request.code()));
    }

    @PostMapping("/2fa/backup-codes")
    public Map<String, Object> twoFactorBackupCodes(@CurrentUser UserPrincipal principal,
                                                    @Valid @RequestBody AuthRequests.TwoFactorCodeRequest request) {
        return Map.of("backupCodes", authService.twoFactorBackupCodes(principal.getId(), request.code()));
    }

    /** Dimentica gli altri dispositivi fidati: al prossimo accesso da li' serve di nuovo il codice. */
    @PostMapping("/2fa/forget-devices")
    public Map<String, Integer> forgetDevices(@CurrentUser UserPrincipal principal,
                                              @Valid @RequestBody AuthRequests.ForgetDevicesRequest request) {
        return Map.of("forgotten", authService.forgetOtherDevices(principal.getId(), request.deviceToken()));
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

    @GetMapping("/profile")
    public Map<String, AuthUserDto> profile(@CurrentUser UserPrincipal principal) {
        return Map.of("user", authService.getProfile(principal.getId()));
    }

    @PatchMapping("/avatar")
    public Map<String, AuthUserDto> updateAvatar(@CurrentUser UserPrincipal principal,
                                                 @Valid @RequestBody AuthRequests.AvatarRequest request) {
        return Map.of("user", authService.updateAvatar(principal.getId(), request.avatar()));
    }

    /** Aspetto dell'avatar nell'hotel, scelto dal guardaroba. */
    @PatchMapping("/look")
    public Map<String, AuthUserDto> updateLook(@CurrentUser UserPrincipal principal,
                                               @Valid @RequestBody AuthRequests.LookRequest request) {
        return Map.of("user", authService.updateLook(principal.getId(), request.look()));
    }
}
