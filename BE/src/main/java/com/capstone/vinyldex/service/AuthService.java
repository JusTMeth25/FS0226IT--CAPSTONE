package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.dto.response.AuthResponse;
import com.capstone.vinyldex.dto.response.AuthUserDto;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Registrazione, accesso, profilo e avatar. */
@Service
public class AuthService {

    /**
     * Le sei immagini presenti in frontend/public/assets/img/avatarN.png.
     * Si salva solo la chiave, mai il percorso: il frontend resta libero di cambiare
     * cartella o estensione senza toccare il database.
     */
    private static final List<String> AVAILABLE_AVATARS =
            List.of("avatar1", "avatar2", "avatar3", "avatar4", "avatar5", "avatar6");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(AuthRequests.RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        String username = request.username().trim();

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("email_taken");
        }
        if (userRepository.existsByUsername(username)) {
            throw ApiException.conflict("username_taken");
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);

        return buildResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(AuthRequests.LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .orElse(null);

        // Stessa risposta per email inesistente e password errata: un messaggio diverso
        // direbbe a un attaccante quali indirizzi sono registrati.
        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw ApiException.unauthorized("invalid_credentials");
        }
        if (user.isBanned()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "user_banned", user.getBanReason());
        }

        return buildResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthUserDto getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("not_found"));
        if (user.isBanned()) {
            throw ApiException.forbidden("user_banned");
        }
        return AuthUserDto.from(user);
    }

    @Transactional
    public AuthUserDto updateAvatar(UUID userId, String avatar) {
        if (!AVAILABLE_AVATARS.contains(avatar)) {
            throw ApiException.badRequest("invalid_avatar");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("not_found"));
        user.setAvatar(avatar);
        return AuthUserDto.from(userRepository.save(user));
    }

    private AuthResponse buildResponse(User user) {
        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getEmail());
        return new AuthResponse(AuthUserDto.from(user), token);
    }
}
