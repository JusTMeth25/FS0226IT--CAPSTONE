package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.dto.response.AuthResponse;
import com.capstone.vinyldex.dto.response.AuthUserDto;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.AuthService;
import jakarta.validation.Valid;
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

    @GetMapping("/profile")
    public Map<String, AuthUserDto> profile(@CurrentUser UserPrincipal principal) {
        return Map.of("user", authService.getProfile(principal.getId()));
    }

    @PatchMapping("/avatar")
    public Map<String, AuthUserDto> updateAvatar(@CurrentUser UserPrincipal principal,
                                                 @Valid @RequestBody AuthRequests.AvatarRequest request) {
        return Map.of("user", authService.updateAvatar(principal.getId(), request.avatar()));
    }
}
