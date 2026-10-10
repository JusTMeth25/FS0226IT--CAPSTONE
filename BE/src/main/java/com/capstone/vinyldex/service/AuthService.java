package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.dto.response.AuthResponse;
import com.capstone.vinyldex.dto.response.AuthUserDto;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.HotelLook;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
            List.of("avatar1", "avatar2", "avatar3", "avatar4", "avatar5", "avatar6", "avatar7");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    /** Verifica in due passaggi e accesso con Google/Apple: facoltativi come il guardaroba, per i test fatti a mano. */
    private TwoFactorService twoFactor;
    private SocialLoginService social;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setTwoFactor(TwoFactorService twoFactor) {
        this.twoFactor = twoFactor;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setSocial(SocialLoginService social) {
        this.social = social;
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
        // saveAndFlush e non save: le date di creazione le scrive Hibernate al flush,
        // altrimenti la risposta le riporterebbe nulle.
        userRepository.saveAndFlush(user);

        return buildResponse(user);
    }

    @Transactional
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
        // Hash con un costo piu' basso di quello attuale (es. i vecchi a 10): ora che abbiamo la
        // password in chiaro lo si rifa' col costo nuovo, senza chiedere nulla all'utente.
        if (passwordEncoder.upgradeEncoding(user.getPasswordHash())) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }

        return complete(user, request.deviceToken());
    }

    /** Accesso con Google o Apple: stesso esito del login con password, secondo passaggio compreso. */
    @Transactional
    public AuthResponse socialLogin(AuthRequests.SocialLoginRequest request) {
        if (social == null) throw ApiException.badRequest("provider_disabled");
        User user = social.authenticate(request.provider(), request.idToken(), request.name());
        if (user.isBanned()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "user_banned", user.getBanReason());
        }
        return complete(user, request.deviceToken());
    }

    /**
     * Ultimo pezzo di ogni accesso: con la verifica in due passaggi attiva e un dispositivo non
     * fidato si risponde col challenge invece che col token.
     */
    private AuthResponse complete(User user, String deviceToken) {
        if (twoFactor != null && twoFactor.needsSecondStep(user, deviceToken)) {
            return AuthResponse.challenge(jwtService.generateChallenge(user.getId()));
        }
        return buildResponse(user);
    }

    /** Secondo passaggio: codice giusto, token di accesso e (se richiesto) dispositivo fidato. */
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse verifySecondStep(AuthRequests.TwoFactorVerifyRequest request, String deviceLabel) {
        UUID userId = jwtService.extractChallengeUserId(request.challenge());
        if (userId == null || twoFactor == null) throw ApiException.unauthorized("two_factor_expired");
        User user = loadUser(userId);
        if (user.isBanned()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "user_banned", user.getBanReason());
        }
        if (!twoFactor.verify(user, request.code())) throw ApiException.unauthorized("invalid_two_factor_code");
        AuthResponse response = buildResponse(user);
        return request.remember() ? response.withDevice(twoFactor.trustDevice(user.getId(), deviceLabel)) : response;
    }

    /** Stato della verifica in due passaggi per la pagina Profilo. */
    @Transactional(readOnly = true)
    public Map<String, Object> twoFactorStatus(UUID userId) {
        User user = loadUser(userId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enabled", user.isTwoFactorEnabled());
        out.put("trustDays", twoFactor.trustDays());
        out.put("trustedDevices", twoFactor.trustedDevices(userId));
        out.put("backupCodesLeft", twoFactor.backupCodesLeft(userId));
        return out;
    }

    @Transactional
    public TwoFactorService.Setup twoFactorSetup(UUID userId) {
        return twoFactor.setup(loadUser(userId));
    }

    /** Attiva la verifica e rende fidato il dispositivo da cui la si attiva. */
    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> twoFactorEnable(UUID userId, String code, String deviceLabel) {
        User user = loadUser(userId);
        List<String> backupCodes = twoFactor.enable(user, code);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("backupCodes", backupCodes);
        out.put("deviceToken", twoFactor.trustDevice(userId, deviceLabel));
        out.put("user", AuthUserDto.from(user));
        return out;
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthUserDto twoFactorDisable(UUID userId, String code) {
        User user = loadUser(userId);
        twoFactor.disable(user, code);
        return AuthUserDto.from(user);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public List<String> twoFactorBackupCodes(UUID userId, String code) {
        return twoFactor.regenerateBackupCodes(loadUser(userId), code);
    }

    @Transactional
    public int forgetOtherDevices(UUID userId, String deviceToken) {
        return twoFactor.forgetOtherDevices(userId, deviceToken);
    }

    public Map<String, Object> socialProviders() {
        return social == null ? Map.of() : social.providers();
    }

    private User loadUser(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("not_found"));
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

    /** Guardaroba di lusso: facoltativo, cosi' i test che costruiscono il servizio a mano non cambiano. */
    private com.capstone.vinyldex.hotel.WardrobeService wardrobeService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setWardrobeService(com.capstone.vinyldex.hotel.WardrobeService wardrobeService) {
        this.wardrobeService = wardrobeService;
    }

    public AuthUserDto updateLook(UUID userId, String look) {
        if (!HotelLook.isValid(look)) {
            throw ApiException.badRequest("invalid_look");
        }
        // Capi, orologi e veicoli dei negozi si indossano solo se comprati.
        if (wardrobeService != null) wardrobeService.requireOwned(userId, look);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("not_found"));
        user.setHotelLook(look);
        return AuthUserDto.from(userRepository.save(user));
    }

    private AuthResponse buildResponse(User user) {
        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getEmail());
        return new AuthResponse(AuthUserDto.from(user), token);
    }
}
